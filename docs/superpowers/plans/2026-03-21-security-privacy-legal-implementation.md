# Security, Privacy & Legal — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all Phase 1 security/privacy/legal items from the [assessment spec](../specs/2026-03-21-security-privacy-legal-assessment-design.md) — documentation artifacts, design decisions, and code patterns ready for integration into Phase 1 build.

**Architecture:** No application code exists yet. This plan produces: (1) compliance documents (ROPA, accepted risk docs, household exemption analysis), (2) architecture decision records for security patterns, (3) code templates for `filterForPrivacy`, security headers, CSRF protection, and Sentry PII filtering that will be integrated during Phase 1 build, (4) DPA initiation checklist.

**Tech Stack:** Markdown (docs), TypeScript (code patterns), Next.js 16 (headers config), Drizzle ORM (query patterns), pino (logging), Sentry SDK, NextAuth.js v5

**Spec:** `docs/superpowers/specs/2026-03-21-security-privacy-legal-assessment-design.md`

**Context:** The `apps/` and `packages/` directories do not exist yet. Code tasks produce standalone files or documented patterns that the Phase 1 build plan will reference and integrate. Each task references the finding IDs from the spec.

---

## File Structure

### Documentation (create now)

```
docs/
├── compliance/
│   ├── ropa.md                          # Record of Processing Activities (DC-3)
│   ├── household-exemption.md           # GDPR Art. 2(2)(c) analysis (PE-7)
│   ├── accepted-risks.md                # Documented accepted risks (DF-4, IS-7, PE-3)
│   └── dpa-checklist.md                 # DPA tracking for all processors (TP-1)
├── architecture/
│   └── decisions/
│       ├── 007-security-headers.md      # CSP + security headers ADR (IS-1, IS-6)
│       ├── 008-rbac-middleware.md        # RBAC enforcement pattern ADR (AA-3)
│       ├── 009-living-person-filter.md   # Comprehensive filter design ADR (PE-1)
│       └── 010-web-mode-transition.md   # Migration review screen design (DF-1)
```

### Code Patterns (create now, integrate during Phase 1 build)

```
docs/
└── architecture/
    └── patterns/
        ├── filter-for-privacy.ts        # Expanded filterForPrivacy implementation (PE-1)
        ├── security-headers.ts          # next.config.ts headers snippet (IS-1, IS-6)
        ├── csrf-middleware.ts            # CSRF token validation pattern (IS-8)
        ├── cookie-security.ts           # Environment-aware cookie config (AA-2)
        ├── sentry-config.ts             # Sentry beforeSend PII filter (DF-3)
        ├── pino-redaction.ts            # API key redaction config (AA-6)
        ├── gedcom-upload-limits.ts      # File size/depth/bounds checking (IS-4)
        └── fts5-safe-query.ts           # Parameterized FTS5 query pattern (IS-9)
```

---

## Task 1: ROPA — Record of Processing Activities

**Findings:** DC-3, Art. 30
**Files:**
- Create: `docs/compliance/ropa.md`

- [ ] **Step 1: Create the ROPA document**

```markdown
# Record of Processing Activities (ROPA)

> GDPR Article 30 — Required for any data controller processing personal data.
> This is a living document. Update when data categories, purposes, or processors change.
> Last reviewed: 2026-03-21

## Processing Activities

| # | Data Category | GDPR Tier | Examples | Purpose | Lawful Basis (Local) | Lawful Basis (Web) | Retention Period | Deletion Mechanism | Processor(s) |
|---|--------------|-----------|----------|---------|---------------------|-------------------|-----------------|-------------------|-------------|
| 1 | Living persons — names, birth dates, birth places | T2: Sensitive PII | `persons`, `person_names`, `events` tables | Genealogy research, family tree building | Art. 2(2)(c) household exemption | Art. 6(1)(a) consent | Until erasure request or account deletion | Hard delete function (PE-5, Phase 4) | Turso (web mode) |
| 2 | Living persons — relationships | T2: Sensitive PII | `families`, `children` tables | Tree structure | Art. 2(2)(c) | Art. 6(1)(a) consent | Until erasure request | Hard delete cascade | Turso |
| 3 | Living persons — photos/media | T2: Sensitive PII | `media`, `media_persons` tables | Document attachment | Art. 2(2)(c) | Art. 6(1)(a) consent | Until erasure request | File deletion + DB hard delete | Turso, local filesystem |
| 4 | Living persons — face embeddings | T1: Special Category (biometric) | `face_regions.embedding` | Face identification in photos | Art. 2(2)(c) | Art. 9(2)(a) explicit consent | Until erasure request | Hard delete | Turso |
| 5 | Religious affiliation (inferred) | T1: Special Category | `events` where type = baptism, confirmation | Historical record keeping | Art. 2(2)(c) | Art. 9(2)(a) explicit consent | Until erasure request | Event deletion | Turso |
| 6 | Deceased persons — all genealogical data | T4: Historical | All tables, filtered by is_living=false or death date exists | Genealogy research | N/A (generally outside GDPR) | N/A | Indefinite | Soft delete available | Turso |
| 7 | App user credentials | T3: Standard PII | NextAuth.js session, email, hashed password | Authentication | Legitimate interest | Art. 6(1)(b) contract | Account lifetime + 30 days | Account deletion | Vercel (session), Turso (credentials) |
| 8 | AI chat messages | T2/T3: Contains PII | User messages + AI responses | Research assistance | Art. 2(2)(c) | Art. 6(1)(a) consent | 90 days (configurable) | Scheduled purge | Anthropic (API), Turso (local log) |
| 9 | AI-proposed relationships | T2: Sensitive PII | `proposed_relationships`, `proposed_persons` | AI research suggestions | Art. 2(2)(c) | Art. 6(1)(f) legitimate interest | Until accepted/rejected + 30 days | Hard delete | Turso |
| 10 | Error tracking data | T3: Standard PII (may contain T2) | Sentry events, stack traces | Bug fixing, reliability | Art. 6(1)(f) legitimate interest | Art. 6(1)(f) legitimate interest | 90 days (Sentry default) | Sentry auto-purge | Sentry |
| 11 | Search queries | T3: Standard PII | FTS5 queries, FamilySearch/NARA queries | Record discovery | Art. 2(2)(c) | Art. 6(1)(f) legitimate interest | Not persisted (stateless) | N/A | FamilySearch, NARA (query only) |
| 12 | OCR text from documents | T4/T2: May contain living person data | `media.ocr_text` | Document digitization | Art. 2(2)(c) | Art. 6(1)(a) consent | Until media deletion | Media hard delete | Transkribus (processing), Turso (storage) |
| 13 | DNA data | T1: Special Category (genetic) | Post-launch: parsed DNA files | Genetic genealogy | Art. 2(2)(c) | Art. 9(2)(a) explicit consent | Until erasure request | Hard delete | Turso |

## Data Flows to Third Parties

| Processor | Data Sent | DPA Status | Data Residency | Transfer Mechanism |
|-----------|-----------|-----------|---------------|-------------------|
| Anthropic (Claude API) | Tree context (50 persons), chat messages, OCR text | Pending | US | SCCs required |
| Turso | Entire database | Pending | Configurable (target: EU) | EU region = no transfer |
| Vercel | HTTP requests, server-side execution | Signed (standard DPA) | US/EU | Vercel DPA covers |
| Sentry | Error events (PII-filtered) | Pending | US/EU | SCCs or EU region |
| FamilySearch | Search queries (names, dates, places) | N/A (independent controller) | US | N/A |
| NARA | Search queries | N/A (independent controller) | US | N/A |
| Transkribus | Document images | Pending | EU | N/A (EU-based) |
| Railway | Job payloads | Pending | Configurable | SCCs if US |

## Notes

- **Local mode** is exempt from most GDPR obligations under Art. 2(2)(c) household exemption. See `docs/compliance/household-exemption.md`.
- **Web mode** triggers full GDPR obligations. See Web Mode Readiness Gate in the security assessment spec.
- Face embeddings (row 4) and DNA data (row 13) are deferred to Phases 3 and post-launch respectively. DPIA required before implementation.
- Art. 9 special category data (rows 4, 5, 13) requires explicit consent — not just legitimate interest.
```

- [ ] **Step 2: Commit**

```bash
git add docs/compliance/ropa.md
git commit -m "docs: create ROPA (Record of Processing Activities) for GDPR Art. 30

Addresses DC-3 from security assessment. Maps all 13 data categories
to purpose, lawful basis, retention, deletion mechanism, and processors."
```

---

## Task 2: GDPR Household Exemption Analysis

**Findings:** PE-7
**Files:**
- Create: `docs/compliance/household-exemption.md`

- [ ] **Step 1: Create the exemption analysis**

```markdown
# GDPR Household Exemption — Applicability to Ancstra

> GDPR Article 2(2)(c): "This Regulation does not apply to the processing of personal data by a natural person in the course of a purely personal or household activity."

## Analysis

### Local Mode: Likely Exempt

Ancstra in local-only mode (SQLite on the user's machine, accessed only via localhost) qualifies for the household exemption because:

1. **Single user** — only the tree owner accesses the data
2. **Personal purpose** — genealogy research for personal/family interest
3. **No publication** — data does not leave the user's machine (except via explicit export)
4. **No commercial activity** — personal use, not a service offered to others

**Precedent:** The CJEU in *Lindqvist* (C-101/01) held that publishing personal data on an internet page is NOT a household activity. Conversely, storing data locally for personal reference IS household activity.

**Edge cases that do NOT break the exemption:**
- Exporting a GEDCOM file and emailing it to a family member (one-time personal sharing)
- Viewing the tree on another device on the same local network

**Edge cases that MAY break the exemption:**
- Sharing a GEDCOM containing living persons' data on a public genealogy forum
- Running the local app as a service for others to access

### Web Mode: NOT Exempt

Deploying Ancstra to Vercel with Turso breaks the household exemption because:

1. **Cloud hosting** — data is processed by third-party infrastructure (Turso, Vercel)
2. **URL-accessible** — anyone with the link can access the tree (even if restricted to family)
3. **Third-party processors** — data is transmitted to processors (Anthropic, Sentry, etc.)
4. **Multiple users** — family members accessing the shared tree are data subjects

**Consequence:** Full GDPR obligations apply from the moment web mode is enabled. See the Web Mode Readiness Gate in the security assessment spec.

### The Transition Is the Legal Inflection Point

The local-to-web transition is not just a database driver swap. It is the moment when:
- The tree owner becomes a **data controller** under GDPR
- Living persons in the tree become **data subjects** with rights (access, erasure, rectification)
- Third-party services become **data processors** requiring DPAs
- A **privacy policy** must be published
- **Consent** may be required for processing living persons' data

This is why the security assessment requires a Web Mode Readiness Gate (Appendix A of the assessment spec).

## Recommendation

1. Document this analysis (this file) and reference it in the Phase 1 compliance checklist
2. Do NOT enable web mode until the Readiness Gate is cleared
3. Consider adding a startup warning in web mode: "You are processing personal data under GDPR. Ensure you have completed the Web Mode Readiness Gate."

## References

- GDPR Article 2(2)(c)
- CJEU Case C-101/01 (*Lindqvist*), 2003
- Article 29 Working Party Opinion 5/2009 on online social networking
- Security Assessment Spec: `docs/superpowers/specs/2026-03-21-security-privacy-legal-assessment-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/compliance/household-exemption.md
git commit -m "docs: GDPR household exemption analysis for local vs web mode

Addresses PE-7. Documents why local mode is likely exempt and web mode
is not, with CJEU precedent and edge case analysis."
```

---

## Task 3: Accepted Risks Documentation

**Findings:** DF-4, IS-7, PE-3
**Files:**
- Create: `docs/compliance/accepted-risks.md`

- [ ] **Step 1: Create the accepted risks register**

```markdown
# Accepted Security & Privacy Risks

> Risks evaluated and accepted with documented rationale. Review at each phase exit gate.
> Last reviewed: 2026-03-21

## AR-1: No Encryption at Rest for Local SQLite (DF-4)

**Risk:** The SQLite database file sits unencrypted on the user's disk. Anyone with file system access can read all genealogical data.

**Severity:** Medium

**Rationale for acceptance:**
- Local-only mode targets personal use on a private machine
- Disk encryption (BitLocker, FileVault, LUKS) is the appropriate layer for at-rest protection on personal devices
- Adding SQLCipher introduces a dependency and key management complexity disproportionate to the threat

**Upgrade path:** SQLCipher can be added as an optional dependency if users request it. The Drizzle ORM layer is agnostic to the underlying SQLite driver.

**Review trigger:** Reconsider if Ancstra is deployed in a multi-user environment or on shared machines.

---

## AR-2: Local Mode Runs on HTTP (IS-7)

**Risk:** `next dev` and `next start` on localhost use HTTP. If someone accesses the app from another device on the same network, credentials and data travel in plaintext.

**Severity:** Low

**Rationale for acceptance:**
- Local mode is designed for single-user access on localhost
- Adding HTTPS to localhost requires certificate management (mkcert or self-signed)
- The attack requires physical network proximity AND knowing the app is running

**Mitigation:** Bind to `127.0.0.1` (not `0.0.0.0`) by default in `next.config.ts` to prevent LAN access.

**Review trigger:** Reconsider if a "LAN sharing" feature is requested.

---

## AR-3: Indirect Identification Through Tree Relationships (PE-3)

**Risk:** Even with the living-person filter replacing names with "Living," the tree structure reveals identity. "Living is the child of Hans Schmidt (1955-2020) and Maria Schmidt (1960-)" is identifiable.

**Severity:** High (but inherent to genealogy apps)

**Rationale for acceptance:**
- This is a fundamental property of family trees — suppressing structure eliminates the app's value
- Every genealogy application (Ancestry, FamilySearch, Gramps) has this same limitation
- The living-person filter (PE-1) reduces the attack surface by stripping dates, places, events, and media

**Mitigation:**
- Viewer role sees relationship counts only, not identities (e.g., "2 children" not "child: Living")
- Owner/admin roles see full data (acceptable for personal use)
- Web mode should default to viewer-level redaction for unauthenticated users

**Review trigger:** Reconsider if a "public tree" sharing feature is added.
```

- [ ] **Step 2: Commit**

```bash
git add docs/compliance/accepted-risks.md
git commit -m "docs: document accepted security/privacy risks (DF-4, IS-7, PE-3)

Three risks accepted with rationale, upgrade paths, and review triggers."
```

---

## Task 4: DPA Tracking Checklist

**Findings:** TP-1 (long-lead item)
**Files:**
- Create: `docs/compliance/dpa-checklist.md`

- [ ] **Step 1: Create the DPA tracking document**

```markdown
# Data Processing Agreement (DPA) Tracking

> GDPR Article 28 requires a DPA with every processor handling EU personal data.
> Long-lead item: vendor response times may be 2-6 weeks. Initiate at Phase 1 exit.
> Last updated: 2026-03-21

## DPA Status

| Processor | Required By | DPA Available? | DPA URL | Status | Initiated | Signed | Notes |
|-----------|------------|---------------|---------|--------|-----------|--------|-------|
| **Vercel** | Web mode | Yes | https://vercel.com/legal/dpa | Not started | | | Standard DPA, sign via dashboard |
| **Turso** | Web mode | TBD | | Not started | | | Check https://turso.tech/legal or contact sales |
| **Anthropic** | Phase 2 (AI) | TBD | | Not started | | | Check API terms; may need custom request |
| **Sentry** | Phase 1 (if web) | Yes | https://sentry.io/legal/dpa/ | Not started | | | Standard DPA available |
| **Railway** | Phase 2 (worker) | TBD | | Not started | | | Check https://railway.app/legal |
| **Transkribus** | Phase 3 (OCR) | TBD | | Not started | | | EU-based (READ-COOP); likely has DPA |

## Action Items

1. [ ] **Phase 1 exit:** Initiate DPA requests with Vercel, Turso, Sentry, Anthropic
2. [ ] **Phase 2 start:** Follow up on pending DPA requests
3. [ ] **Before web mode:** All DPAs for web-mode processors must be signed (Vercel, Turso, Sentry)
4. [ ] **Before AI features:** Anthropic DPA must be signed
5. [ ] **Before Phase 3:** Transkribus DPA must be signed

## What to Check in Each DPA

- [ ] Data residency (EU preferred; if US, SCCs or adequacy decision required)
- [ ] Data retention period (should match our ROPA retention periods)
- [ ] Sub-processor list and notification of changes
- [ ] Breach notification timeline (must support our 72-hour obligation)
- [ ] Data deletion on contract termination
- [ ] Audit rights
```

- [ ] **Step 2: Commit**

```bash
git add docs/compliance/dpa-checklist.md
git commit -m "docs: create DPA tracking checklist for GDPR Art. 28

Addresses TP-1. Tracks DPA status for all 6 processors with action
items and review criteria. Flagged as long-lead item."
```

---

## Task 5: ADR-007 — Security Headers

**Findings:** IS-1, IS-6
**Files:**
- Create: `docs/architecture/decisions/007-security-headers.md`
- Create: `docs/architecture/patterns/security-headers.ts`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR-007: Security Headers Configuration

**Status:** Accepted
**Date:** 2026-03-21
**Context:** The security assessment (IS-1, IS-6) identified missing CSP and security headers. Ancstra renders user-supplied content (person names, notes, OCR text) and must prevent XSS. Web mode requires HSTS.

**Decision:** Configure security headers in `next.config.ts` using the `headers()` async function. Headers are environment-aware: HSTS only applies in production web mode.

**Pattern:** See `docs/architecture/patterns/security-headers.ts` for the implementation to integrate into `apps/web/next.config.ts` during Phase 1 build.

**Consequences:**
- All responses include CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- HSTS is added only when `DEPLOYMENT_MODE=web` env var is set
- CSP must be updated when new third-party scripts/styles are added
- `unsafe-inline` for styles is required by shadcn/ui; `unsafe-eval` is NOT allowed
```

- [ ] **Step 2: Write the code pattern**

```typescript
// docs/architecture/patterns/security-headers.ts
// Integration target: apps/web/next.config.ts
//
// Addresses: IS-1 (CSP), IS-6 (security headers)
// Usage: Import the headers function into next.config.ts

import type { NextConfig } from 'next';

const isWebMode = process.env.DEPLOYMENT_MODE === 'web';

const securityHeaders = [
  {
    // Content Security Policy
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self'",                    // No unsafe-inline, no unsafe-eval
      "style-src 'self' 'unsafe-inline'",     // Required by shadcn/ui
      "img-src 'self' data: blob:",           // data: for inline images, blob: for media
      "font-src 'self'",
      "connect-src 'self'",                   // API calls to same origin
      "frame-ancestors 'none'",               // Equivalent to X-Frame-Options: DENY
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // HSTS only in web mode (not localhost)
  ...(isWebMode
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

// Add to next.config.ts:
// async headers() {
//   return [{ source: '/(.*)', headers: securityHeaders }];
// }

export { securityHeaders };
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/decisions/007-security-headers.md docs/architecture/patterns/security-headers.ts
git commit -m "docs: ADR-007 security headers + implementation pattern

Addresses IS-1 (CSP) and IS-6 (security headers). Environment-aware
HSTS for web mode. Pattern ready for Phase 1 next.config.ts integration."
```

---

## Task 6: ADR-008 — RBAC Middleware Pattern

**Findings:** AA-3, IS-8, AA-2
**Files:**
- Create: `docs/architecture/decisions/008-rbac-middleware.md`
- Create: `docs/architecture/patterns/csrf-middleware.ts`
- Create: `docs/architecture/patterns/cookie-security.ts`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR-008: RBAC Enforcement & CSRF Protection on API Routes

**Status:** Accepted
**Date:** 2026-03-21
**Context:** The security assessment (AA-3) found that API mutation endpoints lack role verification — `filterForPrivacy` only filters read responses, not write access. IS-8 found that API route handlers lack CSRF protection (Server Actions have built-in CSRF, but `/api/` routes do not).

**Decision:**
1. Create a `withAuth` wrapper for API route handlers that verifies session and role before executing the handler.
2. Add CSRF token validation via a custom header check (`X-Requested-With`) on all state-changing API routes. This is the "double-submit" pattern — the browser's same-origin policy prevents cross-origin requests from setting custom headers.

**Pattern:** See `docs/architecture/patterns/csrf-middleware.ts` for implementation.

**Role Requirements by Endpoint:**

| Endpoint | Method | Minimum Role |
|----------|--------|-------------|
| `/api/persons` | GET | viewer |
| `/api/persons` | POST | editor |
| `/api/persons/[id]` | GET | viewer |
| `/api/persons/[id]` | PUT | editor |
| `/api/persons/[id]` | DELETE | admin |
| `/api/families` | POST | editor |
| `/api/families/[id]` | PUT | editor |
| `/api/events` | POST | editor |
| `/api/events/[id]` | PUT | editor |
| `/api/sources` | POST | editor |

**Consequences:**
- Every API route must use `withAuth` — no unprotected mutation endpoints
- CSRF header check applies to POST/PUT/DELETE/PATCH
- Client-side fetch calls must include `X-Requested-With: XMLHttpRequest` header
- Role hierarchy: owner > admin > editor > viewer
```

- [ ] **Step 2: Write the code pattern**

```typescript
// docs/architecture/patterns/csrf-middleware.ts
// Integration target: apps/web/lib/api/middleware.ts
//
// Addresses: AA-3 (RBAC enforcement), IS-8 (CSRF protection)

import { auth } from '@/auth'; // NextAuth.js v5
import { NextRequest, NextResponse } from 'next/server';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface AuthOptions {
  minRole: Role;
}

/**
 * Wraps an API route handler with authentication, authorization, and CSRF checks.
 *
 * Usage:
 *   export const POST = withAuth({ minRole: 'editor' }, async (req, session) => {
 *     // handler code — session is guaranteed valid with sufficient role
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withAuth(
  options: AuthOptions,
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    // 1. Verify session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check CSRF for mutation methods
    if (MUTATION_METHODS.has(req.method)) {
      const csrfHeader = req.headers.get('X-Requested-With');
      if (csrfHeader !== 'XMLHttpRequest') {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    }

    // 3. Check role authorization
    // TODO: Extend NextAuth Session type to include `role` in next-auth.d.ts
    const userRole = (session.user as any).role as Role;
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[options.minRole]) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Execute handler
    return handler(req, session);
  };
}
```

- [ ] **Step 3: Write the cookie security pattern**

```typescript
// docs/architecture/patterns/cookie-security.ts
// Integration target: apps/web/auth.ts (NextAuth.js v5 config)
//
// Addresses: AA-2 (session token security in local vs web mode)
//
// NextAuth.js v5 cookie configuration must be environment-aware:
// - Local mode (localhost): Secure flag cannot be set (no TLS)
// - Web mode (Vercel): Secure, HttpOnly, SameSite=Strict required

const isWebMode = process.env.DEPLOYMENT_MODE === 'web';

/**
 * Cookie configuration for NextAuth.js v5.
 * Add to NextAuthConfig.cookies in apps/web/auth.ts
 */
export const cookieConfig = {
  sessionToken: {
    name: isWebMode ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'strict' as const,
      path: '/',
      // Secure flag: true for web mode (requires HTTPS), false for localhost
      secure: isWebMode,
    },
  },
  csrfToken: {
    name: isWebMode ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
    options: {
      httpOnly: true,
      sameSite: 'strict' as const,
      path: '/',
      secure: isWebMode,
    },
  },
};

// Usage in apps/web/auth.ts:
//
// import { cookieConfig } from '@/lib/auth/cookie-security';
//
// export const { handlers, auth, signIn, signOut } = NextAuth({
//   cookies: cookieConfig,
//   // ... other config
// });
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/decisions/008-rbac-middleware.md docs/architecture/patterns/csrf-middleware.ts docs/architecture/patterns/cookie-security.ts
git commit -m "docs: ADR-008 RBAC/CSRF/cookie security patterns

Addresses AA-3 (RBAC enforcement), IS-8 (CSRF), AA-2 (cookie security).
withAuth wrapper, CSRF header check, and environment-aware cookie config."
```

---

## Task 7: ADR-009 — Comprehensive Living-Person Filter

**Findings:** PE-1, PE-2, AI-1 (root cause)
**Files:**
- Create: `docs/architecture/decisions/009-living-person-filter.md`
- Create: `docs/architecture/patterns/filter-for-privacy.ts`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR-009: Comprehensive Living-Person Filter

**Status:** Accepted
**Date:** 2026-03-21
**Context:** The security assessment (PE-1) found that `filterForPrivacy` only replaces names — it doesn't strip events, places, media, or relationship details. Birth date + birth place is sufficient for re-identification. This is the root cause for PE-1 (incomplete filter), PE-2 (export filter), and AI-1 (AI context leakage).

**Decision:** Expand `filterForPrivacy` to apply role-based redaction at four levels:

| Role | Person Data | Events | Media | Relationships |
|------|------------|--------|-------|---------------|
| owner/admin | Full | Full | Full | Full |
| editor | Full name | Full events, descriptions stripped for living | Full | Full names |
| viewer | "Living" | Birth year + country only | Hidden | Count only ("2 children") |
| export (shareable) | "Living" | Birth year only | Excluded | Count only |
| AI context | "Living" for living; full for deceased | Birth year for living | Never sent | IDs only for living |

**Canonical threshold:** 100 years (per `data-model.md` and `packages/shared/privacy/living-filter.ts`). Note: `phase-1-core.md` references 110 years in two places — reconcile to 100.

**Pattern:** See `docs/architecture/patterns/filter-for-privacy.ts`

**Consequences:**
- Single filter function handles all redaction contexts (API response, export, AI)
- All data access paths must apply the filter — no direct database access bypassing it
- Filter is applied at the service/query layer, not at the component layer
- `buildTreeContext` (AI) must call this filter before constructing context
```

- [ ] **Step 2: Write the code pattern**

```typescript
// docs/architecture/patterns/filter-for-privacy.ts
// Integration target: packages/shared/privacy/living-filter.ts
//
// Addresses: PE-1 (filter completeness), PE-2 (export), AI-1 (AI context)
// Root cause fix: comprehensive filter replacing the name-only version

const LIVING_THRESHOLD_YEARS = 100;

type Role = 'owner' | 'admin' | 'editor' | 'viewer';
type FilterContext = 'api' | 'export_shareable' | 'export_full' | 'ai_context';

interface PersonWithDetails {
  id: string;
  given_name: string;
  surname: string;
  notes: string | null;
  is_living: boolean;
  birth_date_sort?: number;
  death_date_sort?: number;
  events?: EventRecord[];
  media?: MediaRecord[];
  relationships?: RelationshipRecord[];
}

interface EventRecord {
  event_type: string;
  date_original: string | null;
  date_sort: number;
  place_name: string | null;
  description: string | null;
}

interface MediaRecord {
  id: string;
  file_path: string;
  title: string | null;
}

interface RelationshipRecord {
  person_id: string;
  person_name: string;
  relationship_type: string;
}

/**
 * Precedence: is_living=false (explicit override) > death date exists > 100-year threshold > assume living.
 * If is_living is explicitly false, the person is always treated as deceased.
 * If a death date exists, the person is deceased even if is_living was not updated.
 * Otherwise, the 100-year birth threshold determines living status.
 */
export function isPresumablyLiving(person: {
  is_living: boolean;
  birth_date_sort?: number;
  death_date_sort?: number;
}): boolean {
  if (!person.is_living) return false;
  if (person.death_date_sort && person.death_date_sort > 0) return false;
  if (!person.birth_date_sort || person.birth_date_sort === 0) return true;
  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birth_date_sort / 10000);
  return (currentYear - birthYear) < LIVING_THRESHOLD_YEARS;
}

export function filterForPrivacy<T extends PersonWithDetails>(
  persons: T[],
  viewerRole: Role,
  context: FilterContext = 'api'
): T[] {
  // Owner and admin see everything in API context
  if ((viewerRole === 'owner' || viewerRole === 'admin') && context === 'api') {
    return persons;
  }

  // Full export mode: no filtering
  if (context === 'export_full') return persons;

  return persons.map(person => {
    if (!isPresumablyLiving(person)) return person;

    const birthYear = person.birth_date_sort
      ? Math.floor(person.birth_date_sort / 10000)
      : undefined;

    const birthCountry = person.events
      ?.find(e => e.event_type === 'birth')
      ?.place_name?.split(',').pop()?.trim() ?? null;

    // Determine redaction level based on role + context
    const isViewerLevel =
      viewerRole === 'viewer' ||
      context === 'export_shareable' ||
      context === 'ai_context';

    return {
      ...person,
      // Names: always redact for living persons (except editor in API)
      given_name: isViewerLevel ? 'Living' : person.given_name,
      surname: isViewerLevel ? '' : person.surname,
      notes: null, // Always strip notes for living

      // Events: viewer/export/AI get birth year + country only
      events: isViewerLevel
        ? (birthYear
          ? [{
              event_type: 'birth',
              date_original: String(birthYear),
              date_sort: birthYear * 10000 + 101,
              place_name: birthCountry,
              description: null,
            }]
          : [])
        : person.events?.map(e => ({
            ...e,
            // Editor in API: full events but strip descriptions for living
            description: null,
          })),

      // Media: hidden for viewer/export/AI; shown for editor
      media: isViewerLevel ? [] : person.media,

      // Relationships: viewer/export/AI get counts only
      relationships: isViewerLevel
        ? [{
            person_id: '',
            person_name: `${person.relationships?.length ?? 0} relationships`,
            relationship_type: 'summary',
          }]
        : person.relationships,
    } as T;
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/decisions/009-living-person-filter.md docs/architecture/patterns/filter-for-privacy.ts
git commit -m "docs: ADR-009 comprehensive living-person filter design

Root cause fix for PE-1, PE-2, AI-1. Role-based and context-based
redaction covering events, media, relationships — not just names.
Canonical threshold: 100 years."
```

---

## Task 8: ADR-010 — Web Mode Transition Design

**Findings:** DF-1
**Files:**
- Create: `docs/architecture/decisions/010-web-mode-transition.md`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR-010: Local-to-Web Mode Transition Security Design

**Status:** Accepted
**Date:** 2026-03-21
**Context:** The security assessment (DF-1) identified that migrating from local SQLite to Turso uploads the entire database to the cloud with no sanitization step. Users may have sensitive notes (adoption, paternity, mental health) they would not share online. The transition also changes the GDPR status from exempt to regulated.

**Decision:** Implement a pre-migration review screen that:

1. **Scans the database** for sensitive content before upload:
   - Count of living persons (will be shared in the cloud)
   - Persons with non-empty `notes` fields (may contain sensitive text)
   - Events with special category data (baptism, confirmation — religious)
   - Media files (photos of living persons)
   - `privacy_level = 'restricted'` records

2. **Presents a summary** showing what will be uploaded:
   - "X living persons will be stored in Turso (EU region)"
   - "Y persons have notes that will be uploaded"
   - "Z media files will be referenced"
   - Link to ROPA and privacy policy

3. **Offers selective redaction** before migration:
   - Option to clear all notes before upload
   - Option to exclude living persons (deceased-only tree in web mode)
   - Option to exclude media references
   - Confirmation checkbox: "I understand this data will be processed under GDPR"

4. **Runs the Web Mode Readiness Gate** checklist automatically:
   - Verify all Tier 1 blockers from Appendix A are resolved
   - Block migration if any blocker is unresolved

**Implementation phase:** Before web mode is first enabled (Phase 4 or Phase 6, depending on when web deployment is targeted).

**Data flow:**
```
User clicks "Enable Web Mode"
  -> Pre-migration scan runs
  -> Summary screen displayed
  -> User reviews and optionally redacts
  -> Readiness Gate checklist verified
  -> Database uploaded to Turso (EU region)
  -> Cookie config switches to Secure/HttpOnly/SameSite=Strict
  -> App restarts with Turso connection
```

**Consequences:**
- Users cannot accidentally upload sensitive data to the cloud
- The GDPR transition is explicit and informed
- Readiness Gate enforcement prevents premature web deployment
- The migration is a one-time operation (not reversible without manual intervention)
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/decisions/010-web-mode-transition.md
git commit -m "docs: ADR-010 local-to-web transition security design

Addresses DF-1. Pre-migration review screen with sensitive data scan,
selective redaction, and automated Readiness Gate verification."
```

---

## Task 9: Sentry PII Filter Pattern

**Findings:** DF-3
**Files:**
- Create: `docs/architecture/patterns/sentry-config.ts`

- [ ] **Step 1: Write the Sentry configuration pattern**

```typescript
// docs/architecture/patterns/sentry-config.ts
// Integration target: apps/web/sentry.client.config.ts and apps/web/sentry.server.config.ts
//
// Addresses: DF-3 (Sentry may capture PII in error events)

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Strip PII from all events before sending to Sentry
  beforeSend(event) {
    // Strip query parameters from URLs (may contain person names)
    if (event.request?.url) {
      const url = new URL(event.request.url);
      url.search = ''; // Remove all query params
      event.request.url = url.toString();
    }

    // Strip request body (may contain person data in POST/PUT)
    if (event.request?.data) {
      event.request.data = '[REDACTED]';
    }

    // Strip query strings from breadcrumb URLs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data?.url) {
          try {
            const url = new URL(breadcrumb.data.url);
            url.search = '';
            breadcrumb.data.url = url.toString();
          } catch {
            // Not a valid URL, leave as-is
          }
        }
        return breadcrumb;
      });
    }

    return event;
  },

  // Do not send user PII
  beforeSendTransaction(event) {
    if (event.request?.url) {
      const url = new URL(event.request.url);
      url.search = '';
      event.request.url = url.toString();
    }
    return event;
  },
});

// IMPORTANT: Exception messages may contain PII (e.g., "Person 'Maria Schmidt' not found").
// Establish convention: error messages must use IDs, never person names.
// Example: throw new Error(`Person not found: ${personId}`) — NOT `Person '${name}' not found`
// During integration, consider adding exception message scrubbing to beforeSend
// if this convention cannot be guaranteed.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/patterns/sentry-config.ts
git commit -m "docs: Sentry PII filter configuration pattern

Addresses DF-3. beforeSend strips query params, request bodies,
and breadcrumb URLs to prevent PII leakage to Sentry."
```

---

## Task 10: Pino API Key Redaction Pattern

**Findings:** AA-6
**Files:**
- Create: `docs/architecture/patterns/pino-redaction.ts`

- [ ] **Step 1: Write the pino redaction pattern**

```typescript
// docs/architecture/patterns/pino-redaction.ts
// Integration target: apps/web/lib/logger.ts
//
// Addresses: AA-6 (API key management — never log API keys)

import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      // Environment variables that may appear in logs
      'ANTHROPIC_API_KEY',
      'FAMILYSEARCH_API_KEY',
      'TRANSKRIBUS_API_KEY',
      'TURSO_AUTH_TOKEN',
      'SENTRY_DSN',

      // Request headers that may contain auth tokens
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',

      // Response headers
      'res.headers["set-cookie"]',

      // Nested objects
      '*.apiKey',
      '*.api_key',
      '*.token',
      '*.password',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/patterns/pino-redaction.ts
git commit -m "docs: pino API key redaction configuration pattern

Addresses AA-6. Redacts API keys, auth tokens, cookies, and passwords
from structured logs."
```

---

## Task 11: GEDCOM Upload Safety Pattern

**Findings:** IS-4, IS-9
**Files:**
- Create: `docs/architecture/patterns/gedcom-upload-limits.ts`
- Create: `docs/architecture/patterns/fts5-safe-query.ts`

- [ ] **Step 1: Write the GEDCOM upload safety pattern**

```typescript
// docs/architecture/patterns/gedcom-upload-limits.ts
// Integration target: packages/gedcom/parser/ and apps/web/app/api/import/
//
// Addresses: IS-4 (GEDCOM as attack vector)

/** Maximum GEDCOM file size: 50MB */
export const MAX_GEDCOM_FILE_SIZE = 50 * 1024 * 1024;

/** Maximum nesting depth for GEDCOM records */
export const MAX_GEDCOM_DEPTH = 50;

/** Maximum number of persons in a single import */
export const MAX_PERSONS_PER_IMPORT = 100_000;

/** Maximum closure table rebuild iterations (prevents circular reference loops) */
export const MAX_CLOSURE_TABLE_ITERATIONS = 500_000;

/**
 * Validate a GEDCOM file before parsing.
 * Call this before passing the file to the parser.
 */
export function validateGedcomUpload(file: File | Buffer, fileName: string): {
  valid: boolean;
  error?: string;
} {
  // 1. File size check
  const size = file instanceof File ? file.size : file.byteLength;
  if (size > MAX_GEDCOM_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_GEDCOM_FILE_SIZE / 1024 / 1024}MB` };
  }

  // 2. File extension check
  if (!fileName.toLowerCase().endsWith('.ged')) {
    return { valid: false, error: 'File must have .ged extension' };
  }

  // 3. MIME type check (if available)
  if (file instanceof File && file.type && file.type !== 'text/plain' && file.type !== 'application/x-gedcom') {
    return { valid: false, error: `Unexpected MIME type: ${file.type}` };
  }

  return { valid: true };
}

/**
 * Validate a GEDCOM string value for dangerous content.
 * Addresses: IS-3 (input sanitization)
 *
 * IMPORTANT: Do NOT HTML-encode values before storing in the database.
 * React JSX escapes output by default, so storing encoded entities
 * causes double-encoding. Instead:
 * - Store raw values in the database
 * - React JSX auto-escapes on render (safe by default)
 * - Never use raw innerHTML with user data
 *
 * This function strips truly dangerous content (script tags, event handlers)
 * while preserving legitimate characters like & < > in genealogical data
 * (e.g., "Smith & Sons", "Born < 1800").
 */
export function sanitizeGedcomValue(value: string): string {
  return value
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handler attributes (onclick, onerror, etc.)
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol URLs
    .replace(/javascript\s*:/gi, '');
}

/**
 * Check for media path traversal in GEDCOM FILE references.
 * GEDCOM files can reference media via relative paths.
 *
 * Note: Also decode URL-encoded sequences before checking, as %2e%2e
 * could bypass naive string checks.
 */
export function isPathTraversalSafe(filePath: string): boolean {
  // Decode URL-encoded characters first
  const decoded = decodeURIComponent(filePath);
  const normalized = decoded.replace(/\\/g, '/');
  // Reject null bytes (can bypass path checks in some systems)
  if (normalized.includes('\0')) return false;
  return !normalized.includes('..') && !normalized.startsWith('/');
}
```

- [ ] **Step 2: Write the FTS5 safe query pattern**

```typescript
// docs/architecture/patterns/fts5-safe-query.ts
// Integration target: packages/db/queries/search.ts
//
// Addresses: IS-9 (FTS5 query injection)

import { sql } from 'drizzle-orm';

/**
 * Safely construct an FTS5 MATCH query.
 * FTS5 has its own query syntax (AND, OR, NOT, *, NEAR, etc.)
 * that can be injected if user input is not sanitized.
 *
 * This function escapes FTS5 special characters and uses
 * parameterized queries via Drizzle's sql template tag.
 */
export function fts5SafeMatch(userQuery: string): ReturnType<typeof sql> {
  // Escape FTS5 special characters: * " ( ) : ^
  // Replace with spaces (removes operators, keeps search terms)
  const sanitized = userQuery
    .replace(/[*"()^:]/g, ' ')  // Remove FTS5 operators
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '') // Remove FTS5 keywords
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .join(' ');

  if (sanitized.length === 0) {
    return sql`''`; // Empty query
  }

  // Use parameterized query — never concatenate
  return sql`${sanitized}`;
}

// Usage example with Drizzle:
//
// const results = await db
//   .select()
//   .from(ftsPersons)
//   .where(sql`fts_persons MATCH ${fts5SafeMatch(userInput)}`)
//   .limit(20);
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/patterns/gedcom-upload-limits.ts docs/architecture/patterns/fts5-safe-query.ts
git commit -m "docs: GEDCOM upload safety + FTS5 injection prevention patterns

Addresses IS-4 (file size/depth/path traversal limits, input sanitization)
and IS-9 (FTS5 query injection via operator escaping + parameterization)."
```

---

## Task 12: Article 9 Special Category Data Documentation

**Findings:** DC-1
**Files:**
- Modify: `docs/compliance/ropa.md` (add a note — already created in Task 1)

- [ ] **Step 1: Add Article 9 note to ROPA**

Add the following section at the bottom of `docs/compliance/ropa.md`:

```markdown
## Article 9 Special Category Data — Event Types

The following `event_type` values in the `events` table may reveal GDPR Article 9 special category data when linked to living persons:

| Event Type | Special Category | GDPR Basis Required |
|-----------|-----------------|-------------------|
| `baptism` | Religious affiliation | Art. 9(2)(a) explicit consent |
| `confirmation` | Religious affiliation | Art. 9(2)(a) explicit consent |

**Mitigation (implemented via PE-1):** The comprehensive living-person filter (ADR-009) strips all events except birth year for living persons viewed by viewer/export/AI contexts. This prevents religious inference for non-privileged viewers.

**Remaining risk:** Owner and admin roles can see all events for living persons. This is acceptable under the household exemption (local mode) and legitimate interest for the tree owner (web mode), but should be documented in the privacy policy.
```

- [ ] **Step 2: Commit**

```bash
git add docs/compliance/ropa.md
git commit -m "docs: add Article 9 special category data note to ROPA

Addresses DC-1. Documents which event types reveal religious affiliation
and how the living-person filter mitigates the risk."
```

---

## Task 13: Update Security Assessment — Mark Completed Items

**Findings:** All documentation items from P1 checklist
**Files:**
- Modify: `docs/superpowers/specs/2026-03-21-security-privacy-legal-assessment-design.md`

- [ ] **Step 1: Update risk register statuses**

In the risk register (Section 5), update the following rows:

| ID | New Status | Resolution Notes |
|----|-----------|-----------------|
| DC-3 | Resolved | ROPA created at `docs/compliance/ropa.md` |
| PE-7 | Resolved | Household exemption documented at `docs/compliance/household-exemption.md` |
| DF-4 | Accepted Risk | Documented at `docs/compliance/accepted-risks.md#ar-1` |
| IS-7 | Accepted Risk | Documented at `docs/compliance/accepted-risks.md#ar-2` |
| PE-3 | Accepted Risk | Documented at `docs/compliance/accepted-risks.md#ar-3` |
| DC-1 | Resolved | Art. 9 event types documented in ROPA |
| AA-6 | Resolved | Pino redaction pattern at `docs/architecture/patterns/pino-redaction.ts` |

Also check the Phase 1 "Design Now" items and mark those with deliverables:

| Item | New Status |
|------|-----------|
| AA-2 (cookie security) | Cookie security pattern at `docs/architecture/patterns/cookie-security.ts` |
| AA-3 (RBAC middleware) | Designed in ADR-008 |
| DF-1 (migration review) | Designed in ADR-010 |

- [ ] **Step 2: Update document history**

Add entry:
```
| 2026-03-21 | Resolved documentation tasks: ROPA, household exemption, accepted risks, DPA checklist, ADRs 007-010, code patterns for security headers/RBAC/filter/Sentry/pino/GEDCOM/FTS5 | Claude + nearl |
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-03-21-security-privacy-legal-assessment-design.md
git commit -m "docs: update security assessment — mark completed P1 items

7 risk register items resolved or accepted. Design Now items covered
by ADRs 007-010. All P1 documentation deliverables complete."
```

---

## Summary

| Task | Type | Findings Addressed | Status |
|------|------|-------------------|--------|
| 1. ROPA | Compliance doc | DC-3, Art. 30 | Ready |
| 2. Household Exemption | Legal analysis | PE-7 | Ready |
| 3. Accepted Risks | Risk documentation | DF-4, IS-7, PE-3 | Ready |
| 4. DPA Checklist | Compliance tracker | TP-1 | Ready |
| 5. Security Headers ADR + Pattern | ADR + code | IS-1, IS-6 | Ready |
| 6. RBAC/CSRF/Cookie ADR + Patterns | ADR + code | AA-3, IS-8, AA-2 | Ready |
| 7. Living-Person Filter ADR + Pattern | ADR + code | PE-1, PE-2, AI-1 | Ready |
| 8. Web Transition ADR | ADR | DF-1 | Ready |
| 9. Sentry PII Filter | Code pattern | DF-3 | Ready |
| 10. Pino Redaction | Code pattern | AA-6 | Ready |
| 11. GEDCOM Safety + FTS5 | Code patterns | IS-4, IS-3, IS-9 | Ready |
| 12. Article 9 Documentation | ROPA update | DC-1 | Ready |
| 13. Update Assessment | Status tracking | All | Ready |

**Remaining P1 items for Phase 1 build integration (not in this plan — handled during code implementation):**
- AA-1: Password hashing (implement when NextAuth.js is configured)
- AA-2: Cookie security (integrate pattern from Task 6 into `apps/web/auth.ts`)
- AA-5: Rate limiting (implement when API routes are built)
- PE-2: Export filter (implement when GEDCOM export is built)
- IS-1: Security headers (integrate pattern from Task 5 into `next.config.ts`)
- IS-2: SQLite backup API (implement when backup mechanism is built)
- IS-3: Input sanitization for non-GEDCOM inputs (API route form submissions — React JSX auto-escapes output, so this is low risk; verify no raw innerHTML usage)
- IS-8: CSRF protection (integrate pattern from Task 6 into API routes)
- DF-5: PWA cache clear (implement when PWA is configured)
