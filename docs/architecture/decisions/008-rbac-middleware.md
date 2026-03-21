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
