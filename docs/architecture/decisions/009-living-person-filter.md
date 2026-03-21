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
