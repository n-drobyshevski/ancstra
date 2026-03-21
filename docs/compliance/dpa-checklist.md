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
