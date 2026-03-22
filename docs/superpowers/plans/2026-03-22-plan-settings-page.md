# Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full settings page at `/settings` with 4 sections: Search Sources (provider config with health/toggles/API keys), Appearance (theme), Privacy (living person controls), and Data (backup/restore/storage).

**Architecture:** Next.js nested layout at `app/(auth)/settings/layout.tsx` with sidebar nav. Each section is a separate page. Provider config stored in `search_providers` table. Privacy/appearance settings in localStorage (single-user app). API routes for provider CRUD, health checks, backup/restore.

**Tech Stack:** Next.js App Router, shadcn/ui, Drizzle ORM, Vitest

**Spec:** [Settings Page Design](../../superpowers/specs/2026-03-22-settings-page-design.md)

---

## File Structure

### New Files

```
apps/web/
  app/(auth)/settings/
    layout.tsx                    # Settings shell with sidebar nav
    page.tsx                      # Redirect to /settings/sources
    sources/page.tsx              # Search Sources section
    appearance/page.tsx           # Appearance section
    privacy/page.tsx              # Privacy section
    data/page.tsx                 # Data section
  app/api/settings/
    providers/route.ts            # GET list providers, POST seed defaults
    providers/[id]/route.ts       # PATCH update provider config
    providers/[id]/test/route.ts  # POST test connection
    storage/route.ts              # GET storage usage stats
    backup/route.ts               # POST download backup
    restore/route.ts              # POST upload restore
    cache/route.ts                # DELETE clear cache
    archives/route.ts             # DELETE clear archives
  components/settings/
    settings-nav.tsx              # Left sidebar navigation
    provider-card.tsx             # Individual provider config card
    worker-status.tsx             # Worker health banner
    storage-usage.tsx             # Storage bar + breakdown
    theme-selector.tsx            # Light/Dark/System toggle
    privacy-settings.tsx          # Privacy controls form
    data-settings.tsx             # Backup/restore/clear controls
  lib/settings/
    providers-client.ts           # React hooks for provider CRUD + health
    settings-store.ts             # localStorage helpers for privacy/appearance
```

### Modified Files

```
apps/web/components/app-sidebar.tsx   # Add Settings nav item
```

---

## Task 1: Settings Shell + Navigation

**Files:**
- Create: `apps/web/app/(auth)/settings/layout.tsx`, `apps/web/app/(auth)/settings/page.tsx`, `apps/web/components/settings/settings-nav.tsx`
- Modify: `apps/web/components/app-sidebar.tsx`

- [ ] **Step 1:** Create `apps/web/components/settings/settings-nav.tsx` — left sidebar component:
  - 4 nav items: Search Sources (`/settings/sources`), Appearance (`/settings/appearance`), Privacy (`/settings/privacy`), Data (`/settings/data`)
  - Each item: icon + label, active state based on `usePathname()`
  - 200px fixed width, border-right
  - Icons: Search, Palette, Shield, Database (from lucide-react)

- [ ] **Step 2:** Create `apps/web/app/(auth)/settings/layout.tsx` — settings shell:
  - Page title "Settings" at top
  - Flex layout: SettingsNav (left) + `{children}` (right, scrollable)
  - `min-height: calc(100vh - header)` to fill page

- [ ] **Step 3:** Create `apps/web/app/(auth)/settings/page.tsx` — redirect:
  ```typescript
  import { redirect } from 'next/navigation';
  export default function SettingsPage() {
    redirect('/settings/sources');
  }
  ```

- [ ] **Step 4:** Add "Settings" link to `apps/web/components/app-sidebar.tsx` with Settings icon from lucide-react. Place after "Sources" in the nav items array.

- [ ] **Step 5:** Verify navigation works — clicking Settings in sidebar → loads settings shell with nav.

- [ ] **Step 6:** Commit: `feat(settings): settings page shell with sidebar navigation`

---

## Task 2: Provider Config API Routes

**Files:**
- Create: `apps/web/app/api/settings/providers/route.ts`, `apps/web/app/api/settings/providers/[id]/route.ts`, `apps/web/app/api/settings/providers/[id]/test/route.ts`
- Create: `apps/web/lib/settings/providers-client.ts`

- [ ] **Step 1:** Create `apps/web/app/api/settings/providers/route.ts`:
  - GET: query `search_providers` table, return all providers with config. If table is empty, seed with default providers (id, name, type, baseUrl, rateLimitRpm, isEnabled defaults).
  - Seed data: familysearch, nara, wikitree, openarchives, chronicling_america, findagrave, web_search, geneanet — matching the ALL_PROVIDERS list from source-selector.tsx.

- [ ] **Step 2:** Create `apps/web/app/api/settings/providers/[id]/route.ts`:
  - PATCH: update provider fields (isEnabled, config JSON for API keys, rateLimitRpm, baseUrl). Validate with zod.
  - Return updated provider.

- [ ] **Step 3:** Create `apps/web/app/api/settings/providers/[id]/test/route.ts`:
  - POST: instantiate the provider by ID, call `healthCheck()`, return `{ status, responseTimeMs }`.
  - Use a switch/map from provider ID to provider class.
  - 5s timeout.

- [ ] **Step 4:** Create `apps/web/lib/settings/providers-client.ts` — React hooks:
  - `useProviders()` — fetch GET /api/settings/providers, return { providers, isLoading, mutate }
  - `updateProvider(id, data)` — PATCH, revalidate
  - `testProvider(id)` — POST test, return result

- [ ] **Step 5:** Commit: `feat(settings): provider config API routes and client hooks`

---

## Task 3: Worker Status Banner + Provider Cards

**Files:**
- Create: `apps/web/components/settings/worker-status.tsx`, `apps/web/components/settings/provider-card.tsx`

- [ ] **Step 1:** Create `apps/web/components/settings/worker-status.tsx`:
  - Fetches worker health from WORKER_URL/health on mount
  - Shows: health dot, "Background Worker", URL, uptime, "Test Connection" button
  - Green border when healthy, red border when down, gray when unknown
  - If WORKER_URL not set, show "Not configured" with help text

- [ ] **Step 2:** Create `apps/web/components/settings/provider-card.tsx`:
  - Props: provider data (from API), onUpdate callback, onTest callback
  - Header: icon (2-letter abbrev, category-colored bg), name, description, health dot, status badge, enable/disable toggle
  - Expandable config section (always visible when card has configurable fields):
    - API key: masked input with eye toggle, save on blur
    - Rate limit: number input (req/min), save on blur
    - Base URL: text input (for SearXNG), save on blur
    - Engine selector: button group (for web search: SearXNG vs Brave)
    - Test Connection: button, shows result inline (status + response time)
    - Last health check: timestamp + response time
  - Auto-save on field change (debounced 500ms) with toast notification
  - Different status badges per state:
    - isEnabled + healthy → green "Online"
    - isEnabled + needs OAuth → amber "Needs Auth"
    - isEnabled + requires worker + worker down → red "Worker Required"
    - !isEnabled → gray "Disabled"
    - no config needed + healthy → green "Online"
    - no config set → gray "Not Configured"

- [ ] **Step 3:** Commit: `feat(settings): worker status banner and provider config cards`

---

## Task 4: Search Sources Page

**Files:**
- Create: `apps/web/app/(auth)/settings/sources/page.tsx`

- [ ] **Step 1:** Create `apps/web/app/(auth)/settings/sources/page.tsx`:
  - Server component wrapper, renders client component
  - Client component uses `useProviders()` hook
  - Layout:
    - Section title "Search Sources" + description
    - WorkerStatus banner
    - Provider cards grouped by category (Databases, Newspapers, Cemeteries, Web)
    - Category headers with colored dot + label
  - Loading state: skeleton cards
  - Error state: retry button

- [ ] **Step 2:** Wire up toggle/config changes to `updateProvider()` + toast

- [ ] **Step 3:** Wire up test button to `testProvider()` + inline result display

- [ ] **Step 4:** Commit: `feat(settings): search sources settings page with provider management`

---

## Task 5: Appearance Page

**Files:**
- Create: `apps/web/app/(auth)/settings/appearance/page.tsx`, `apps/web/components/settings/theme-selector.tsx`
- Create: `apps/web/lib/settings/settings-store.ts`

- [ ] **Step 1:** Create `apps/web/lib/settings/settings-store.ts` — localStorage helper:
  - `getSettings()` / `updateSettings(partial)` for privacy + appearance prefs
  - Keys namespaced: `ancstra:settings:*`
  - Type: `{ theme, livingThreshold, defaultPrivacy, exportPrivacy }`

- [ ] **Step 2:** Create `apps/web/components/settings/theme-selector.tsx`:
  - Uses `useTheme()` from `next-themes` (already installed)
  - 3-button toggle: Light / Dark / System
  - Active button highlighted with primary style

- [ ] **Step 3:** Create `apps/web/app/(auth)/settings/appearance/page.tsx`:
  - Section title "Appearance"
  - ThemeSelector component
  - Simple, minimal page

- [ ] **Step 4:** Commit: `feat(settings): appearance page with theme toggle`

---

## Task 6: Privacy Page

**Files:**
- Create: `apps/web/app/(auth)/settings/privacy/page.tsx`, `apps/web/components/settings/privacy-settings.tsx`

- [ ] **Step 1:** Create `apps/web/components/settings/privacy-settings.tsx`:
  - Living Person Threshold: number input (default 100), description, saves to localStorage
  - Default Privacy Level: 3-button toggle (Public/Private/Restricted), saves to localStorage
  - Export Privacy: toggle switch, saves to localStorage
  - Each setting: label + help text on left, control on right
  - Auto-save on change with subtle toast

- [ ] **Step 2:** Create `apps/web/app/(auth)/settings/privacy/page.tsx`:
  - Section title "Privacy"
  - PrivacySettings component

- [ ] **Step 3:** Commit: `feat(settings): privacy page with living person threshold and export controls`

---

## Task 7: Data & Storage Page

**Files:**
- Create: `apps/web/app/(auth)/settings/data/page.tsx`, `apps/web/components/settings/storage-usage.tsx`, `apps/web/components/settings/data-settings.tsx`
- Create: `apps/web/app/api/settings/storage/route.ts`, `apps/web/app/api/settings/backup/route.ts`, `apps/web/app/api/settings/cache/route.ts`, `apps/web/app/api/settings/archives/route.ts`

- [ ] **Step 1:** Create `apps/web/app/api/settings/storage/route.ts`:
  - GET: calculate sizes — database file size (fs.stat), archives directory size, screenshots directory size
  - Return: `{ total, database, archives, screenshots }`

- [ ] **Step 2:** Create `apps/web/app/api/settings/backup/route.ts`:
  - POST: read SQLite file, return as downloadable file (Content-Disposition: attachment)

- [ ] **Step 3:** Create `apps/web/app/api/settings/cache/route.ts`:
  - DELETE: clear research_items where status='dismissed', clear any temp cache tables
  - Return: `{ cleared: count }`

- [ ] **Step 4:** Create `apps/web/app/api/settings/archives/route.ts`:
  - DELETE: remove all files from ARCHIVE_PATH directory
  - Update research_items to null out archivedHtmlPath and screenshotPath
  - Return: `{ freedBytes }`

- [ ] **Step 5:** Create `apps/web/components/settings/storage-usage.tsx`:
  - Fetches from GET /api/settings/storage
  - Progress bar showing usage
  - Breakdown: Database / Archives / Screenshots with sizes
  - Refreshes after any clear/delete action

- [ ] **Step 6:** Create `apps/web/components/settings/data-settings.tsx`:
  - Download Backup button → POST /api/settings/backup → trigger download
  - Upload Backup button → file input → POST /api/settings/restore (with confirmation dialog: "This will replace your entire database")
  - Clear Search Cache button → DELETE /api/settings/cache
  - Clear Web Archives button (destructive) → confirmation dialog → DELETE /api/settings/archives
  - Delete All Data button (destructive) → double confirmation ("type DELETE to confirm") → wipe everything
  - Each destructive action shows freed space in toast after completion

- [ ] **Step 7:** Create `apps/web/app/(auth)/settings/data/page.tsx`:
  - Section title "Data & Storage"
  - StorageUsage component
  - DataSettings component

- [ ] **Step 8:** Commit: `feat(settings): data page with storage usage, backup/restore, and cache management`

---

## Summary

| Task | What | ~Duration |
|------|------|-----------|
| 1 | Settings shell + sidebar nav | 0.5d |
| 2 | Provider config API routes + hooks | 1d |
| 3 | Worker status banner + provider cards | 1d |
| 4 | Search Sources page (wiring) | 0.5d |
| 5 | Appearance page (theme toggle) | 0.25d |
| 6 | Privacy page | 0.5d |
| 7 | Data & storage page | 1.5d |

**Total:** ~5 days, ~7 commits
