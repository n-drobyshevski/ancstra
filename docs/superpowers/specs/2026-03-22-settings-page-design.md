# Settings Page Design

> Date: 2026-03-22 | Status: Approved
> Phase: 2 (addition)

## Overview

Full settings page at `/settings` with left sidebar navigation and 4 sections: Search Sources, Appearance, Privacy, Data. The Search Sources section is the primary feature — provider configuration with health monitoring, API keys, rate limits, and toggles.

## Sections

### 1. Search Sources (default section)

**Worker Status Banner** — top of section. Shows Hono worker health (online/offline), URL, uptime, "Test Connection" button. Green border when healthy, red when down.

**Provider Cards** — grouped by category (Databases, Newspapers & Media, Cemeteries, Web & Community). Each card contains:

| Element | Description |
|---------|-------------|
| Icon + Name + Description | Provider identity |
| Health dot | Green (online), amber (degraded), red (offline), gray (unknown) |
| Status badge | "Online" / "Needs Auth" / "Worker Required" / "Not Configured" |
| Enable/disable toggle | Persisted in `search_providers` table |
| API key field | Where needed (NARA, Brave). Masked input with show/hide. Saved to `search_providers.config` JSON |
| Rate limit | Editable number input (req/min). Default per provider |
| Base URL | For self-hosted providers (SearXNG). Text input |
| Engine selector | For Web Search: SearXNG vs Brave toggle |
| Test Connection button | Calls provider's `healthCheck()`, shows result inline |
| Last health check | Timestamp + response time from last check |

**Provider list:**
- Databases: FamilySearch (OAuth), NARA (API key optional), WikiTree (free), OpenArchives (free)
- Newspapers: Chronicling America (free, no key)
- Cemeteries: Find A Grave (scraper, requires worker)
- Web: Web Search (SearXNG URL or Brave API key), Geneanet (scraper, requires worker)

### 2. Appearance

| Setting | Control | Description |
|---------|---------|-------------|
| Theme | 3-button toggle: Light / Dark / System | Uses existing `next-themes` provider |

### 3. Privacy

| Setting | Control | Description |
|---------|---------|-------------|
| Living Person Threshold | Number input (default: 100 years) | Persons born within N years with no death date = living |
| Default Privacy Level | 3-button toggle: Public / Private / Restricted | Applied to newly created persons |
| Export Privacy | Toggle | Strip living person details from GEDCOM exports by default |

### 4. Data & Storage

| Setting | Control | Description |
|---------|---------|-------------|
| Storage Usage | Bar chart + breakdown | Database size, archives size, screenshots size |
| Backup Database | Download button | Downloads SQLite file |
| Restore from Backup | Upload button | Replaces current database (with confirmation dialog) |
| Clear Search Cache | Button | Removes cached search results |
| Clear Web Archives | Destructive button | Deletes archived HTML + screenshots |
| Delete All Data | Destructive button (double confirmation) | Wipes database and all files |

## URL Structure

```
/settings                  # Redirects to /settings/sources
/settings/sources          # Search Sources (default)
/settings/appearance       # Theme
/settings/privacy          # Privacy controls
/settings/data             # Data & storage management
```

Active section stored in URL path for direct linking and back-button support.

## Data Storage

Provider configuration (API keys, rate limits, enabled state) stored in `search_providers` table. The `config` column (JSON text) holds API keys and custom settings. Privacy settings stored in a new `user_settings` table or localStorage (simpler for single-user).

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/settings/providers` | GET | List all providers with config |
| `PATCH /api/settings/providers/[id]` | PATCH | Update provider config (enabled, rate limit, API key) |
| `POST /api/settings/providers/[id]/test` | POST | Run health check on specific provider |
| `GET /api/settings/storage` | GET | Get storage usage stats |
| `POST /api/settings/backup` | POST | Trigger database backup download |
| `POST /api/settings/restore` | POST | Upload and restore database |
| `DELETE /api/settings/cache` | DELETE | Clear search cache |
| `DELETE /api/settings/archives` | DELETE | Clear web archives |

## UI Components

```
apps/web/
  app/(auth)/settings/
    layout.tsx              # Settings shell with sidebar nav
    page.tsx                # Redirect to /settings/sources
    sources/page.tsx        # Search Sources section
    appearance/page.tsx     # Appearance section
    privacy/page.tsx        # Privacy section
    data/page.tsx           # Data section
  components/settings/
    settings-nav.tsx        # Left sidebar navigation
    provider-card.tsx       # Individual provider config card
    worker-status.tsx       # Worker health banner
    storage-usage.tsx       # Storage bar chart
    theme-selector.tsx      # Light/Dark/System toggle
    privacy-settings.tsx    # Privacy controls
    data-settings.tsx       # Backup/restore/clear controls
```

## Design Notes

- Follows Heritage Modern / Indigo Heritage palette
- Left sidebar nav pattern (200px fixed width)
- Cards for providers — one card per provider, grouped by category
- Destructive actions (clear archives, delete all) use red variant buttons with confirmation dialogs
- API keys masked by default with eye toggle to reveal
- Settings auto-save on change (no explicit Save button) with toast confirmation
- Health checks throttled (30s minimum between checks per provider)
