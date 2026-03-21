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
