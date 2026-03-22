# FamilySearch API & Sync

> Phase: 2 | Status: Not Started
> Depth: design-level
> Dependencies: [data-model.md](../architecture/data-model.md), [sync-strategy.md](../architecture/sync-strategy.md)
> Data model: persons table (fs_person_id, fs_last_sync), match_candidates, change_log

## Overview

FamilySearch provides access to 66 billion genealogical records via OAuth 2.0 PKCE authentication. This module implements the API client, hints engine for record discovery, and the Phase 2 pull-only sync strategy with conflict resolution through explicit user matching acceptance.

## Requirements

- [ ] OAuth 2.0 PKCE flow implementation with secure code verifier generation
- [ ] API client with rate limiting (30 requests/min, respecting Retry-After headers)
- [ ] Person and genealogy endpoints (ancestors, descendants, pedigrees)
- [ ] Record search endpoints with multi-source coverage
- [ ] Place authority lookup (6M+ locations)
- [ ] Hints engine: generate match candidates for each tree person
- [ ] Sync metadata tracking (fs_person_id, fs_last_sync on persons table)
- [ ] Pull-only sync strategy (Phase 2) with conflict model via match_candidates
- [ ] Caching strategy with React Query and SQLite
- [ ] Token refresh handling on 401 responses
- [ ] Error recovery and rate limit backoff

## Design

### OAuth 2.0 PKCE Flow

```
┌──────────┐                              ┌────────────────┐
│  Browser  │                              │  FamilySearch  │
│           │  1. Click "Connect FS"       │  OAuth Server  │
│           │─────────────────────────────→ │                │
│           │  Authorization URL with       │                │
│           │  code_challenge (S256)        │                │
│           │                              │                │
│           │  2. User logs in & consents  │                │
│           │  ←─────────────────────────── │                │
│           │  Redirect with auth code     │                │
│           │                              │                │
│  Next.js  │  3. Exchange code + verifier │                │
│  Server   │─────────────────────────────→│                │
│           │  ←─────────────────────────── │                │
│           │  access_token + refresh_token │                │
└──────────┘                              └────────────────┘
```

**Key signatures:**

```typescript
function generateAuthUrl(clientId: string, redirectUri: string):
  { url: string; codeVerifier: string }

async function exchangeCodeForTokens(
  code: string, codeVerifier: string, clientId: string, redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>
```

### API Client with Rate Limiting

FamilySearch allows ~18 seconds of execution time per minute per user. Implemented as token bucket algorithm with 30 requests/min (conservative).

**Key signatures:**

```typescript
class FamilySearchClient {
  constructor(accessToken: string)
  async getPerson(personId: string): Promise<FSPerson>
  async getAncestry(personId: string, generations?: number): Promise<FSAncestry>
  async getDescendancy(personId: string, generations?: number): Promise<FSDescendancy>
  async searchPersons(query: FSSearchQuery): Promise<FSSearchResult>
  async searchRecords(query: FSSearchQuery): Promise<FSRecordSearchResult>
  async searchPlaces(name: string): Promise<FSPlace[]>
  async getPlace(placeId: string): Promise<FSPlace>
  private async request<T>(path: string, options?: RequestInit): Promise<T>
}

class RateLimiter {
  async acquire(): Promise<void>
  private refill(): void
}
```

### Hints Engine

Automatically discovers potential record matches for each person in the tree. Generates one or more search queries per person (name + birth/death), executes searches, scores results, and deduplicates.

**Data structure:**

```typescript
interface Hint {
  personId: string;        // Local person ID
  externalId: string;      // FamilySearch record/person ID
  source: 'familysearch' | 'nara' | 'chronicling_america'
  matchScore: number;      // 0-1 probability
  recordType: string;      // 'census', 'vital', 'military', etc.
  summary: string;         // Human-readable summary
  externalData: object;    // Raw external record
}

async function generateHintsForPerson(
  personId: string,
  db: DrizzleDatabase,
  fsClient: FamilySearchClient
): Promise<Hint[]>
```

**Algorithm:**
1. Fetch person from local database with details (names, events)
2. Build search queries from primary name + birth/death dates/places
3. Execute searches on FamilySearch records
4. Score each result (threshold >= 0.5)
5. Deduplicate and sort by score

**Search queries generated:**
- Name + birth date/place
- Name + death date/place (broader)
- Name + spouse surname (for marriage records)

### Sync Strategy

#### Phase 2: Pull-Only

```
FamilySearch (upstream) ──pull──→ Local SQLite (downstream)
                                ↑ User edits locally
```

- One-way pull from FamilySearch into local database
- No automatic overwrites of local records
- Conflict resolution: FamilySearch data creates `match_candidates` entries
- User explicitly accepts or rejects each match
- Sync metadata: `fs_person_id` and `fs_last_sync` track linkage
- Offline queue: mutations queued in IndexedDB, replayed on reconnect

#### Phase 5: Bidirectional (Future)

Three-way merge with manual conflict resolution:
- Common ancestor: last-sync snapshot
- If only local changed: push to FamilySearch
- If only remote changed: pull to local
- If both changed same field: surface for manual resolution
- Change log audit trail for all sync operations

### Caching Strategy

| Data Type | Cache Location | TTL | Invalidation |
|-----------|----------------|-----|--------------|
| Person details | React Query | 5 min | On edit |
| Search results | React Query | 1 min | On new search |
| Place authority | SQLite (places table) | 30 days | Manual refresh |
| FamilySearch records | match_candidates table | Permanent | Manual re-search |
| API tokens | Secure cookie/localStorage | Until expiry | On 401 response |

## Edge Cases & Error Handling

- **Rate limit 429:** Wait Retry-After seconds, retry request
- **Unauthorized 401:** Attempt token refresh, retry request
- **Offline sync:** Queue mutations in IndexedDB, detect conflicts via timestamp comparison on sync
- **Large trees:** Hints computed in background, per-person basis
- **Living persons:** Excluded from record searches (privacy)
- **Search failures:** Log and continue; one failed search doesn't block all hints

## Open Questions

- Optimal refresh window for hints (daily, weekly, manual)?
- cM-based DNA matching with FamilySearch DNA feature (Phase 5)?
- Support for private trees (invitation-only access)?

## Implementation Notes

Location: `apps/web/lib/familysearch/`, `packages/sync/`

File structure:
- `auth.ts` - OAuth flow and token management
- `client.ts` - API client with rate limiting
- `hints.ts` - Hints engine
- `offline-queue.ts` - Offline mutation queueing
