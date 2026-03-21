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
