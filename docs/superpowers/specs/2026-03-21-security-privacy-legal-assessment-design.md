# Security, Privacy & Legal Assessment — Design Spec

> **Type:** Living document (evolves per phase)
> **Approach:** Risk-domain structure with phase annotations (Hybrid — Approach C)
> **Scope:** Full assessment — threat model + GDPR compliance mapping + remediation plan
> **Jurisdiction:** GDPR
> **Deployment modes:** Local (SQLite) + Web (Turso/Vercel) + the transition between them
> **Data subjects:** Tree persons + app users + third-party API data flows
> **AI governance:** Full — data minimization, prompt injection, hallucination, cost security
> **Review cadence:** Review at every phase exit gate. Update severity and phase annotations based on current architecture.
> **Created:** 2026-03-21

---

## 1. Executive Summary

Ancstra is an AI-powered personal genealogy app with two deployment modes: local-first (SQLite on the user's machine) and web (Turso + Vercel for family sharing). This assessment identifies security, privacy, and legal risks across both modes, the transition between them, and all third-party integrations.

### Key Findings

| Severity | Count | Top Concerns |
|----------|-------|-------------|
| **Critical** | 4 | Living-person filter incomplete (PE-1), prompt injection via external records (AI-3), no local-to-web transition sanitization (DF-1), no DPA strategy (TP-1) |
| **High** | 17 | Password hashing (AA-1), RBAC enforcement gaps (AA-3), multi-user auth gates web mode (AA-4), PII sent to Claude API (DF-2), face embeddings as biometric data (DC-2), soft delete doesn't satisfy erasure (PE-5), no CSP headers (IS-1), CSRF unprotected (IS-8) |
| **Medium** | 16 | No encryption at rest (DF-4), PWA cache stores PII (DF-5), Sentry PII leakage (DF-3), no AI audit trail (AI-5), GEDCOM as attack vector (IS-4), FTS5 injection (IS-9) |
| **Low** | 7 | Deceased person protections vary by member state (DC-4), HTTP on localhost (IS-7), API key client exposure (TP-6) |

### Core Architectural Risk

Local mode is largely GDPR-exempt under the household exemption (Article 2(2)(c)). The transition to web mode triggers nearly every GDPR obligation simultaneously. This is not just a technical migration (swapping database drivers) — it is a legal inflection point requiring a hard readiness gate.

### Root Cause: `filterForPrivacy` is the Foundation

Findings PE-1, PE-2, AI-1, and the privacy dimension of DF-1 all share a single root cause: the `filterForPrivacy` function is shallow (names only). Fixing PE-1 comprehensively addresses the foundation for all four findings.

### Threshold Note

This document uses the 100-year living threshold as canonical, matching `data-model.md` and the code in `packages/shared/privacy/living-filter.ts`. Note: `phase-1-core.md` references 110 years in two places (GEDCOM import filter, risk mitigations). These should be reconciled to 100 years for consistency.

### Threat Actors

| Actor | Motivation | Relevant Findings |
|-------|-----------|-------------------|
| **Malicious family member** | Privilege escalation (viewer -> editor) | AA-3, AA-4 |
| **External attacker** | Data theft, XSS, CSRF on web deployment | IS-1, IS-3, IS-8, AA-1, AA-2 |
| **Curious co-worker** | Accessing local SQLite file or PWA cache | DF-4, DF-5 |
| **Compromised third-party API** | Returning malicious data (prompt injection) | AI-3, IS-4 |
| **Automated scanner** | Brute force, credential stuffing on web mode | AA-1, AA-5 |

---

## 2. System Context

### 2.1 Architecture Overview

Ancstra operates in three modes with fundamentally different threat profiles:

| Mode | Database | Hosting | GDPR Status |
|------|----------|---------|-------------|
| Local Development | SQLite via better-sqlite3 | localhost | Exempt (household) |
| Local Production | SQLite via better-sqlite3 | localhost | Exempt (household) |
| Web (Family Sharing) | Turso (edge SQLite) | Vercel | **Full GDPR obligations** |

### 2.2 Trust Boundary Map

```
TB1: User's Machine (highest trust)
 +-------------------------------------------------+
 |  Browser (client)  <-->  Next.js (localhost)     |
 |                            |                     |
 |                         SQLite DB                |
 +---------------------+---------------------------+
                        |
          TB2: TRANSITION (local --> web)
          - Entire database uploaded to cloud
          - Legal status changes from exempt to regulated
          - No sanitization checkpoint exists (CRITICAL)
                        |
 +----------------------v---------------------------+
 |  TB3: Cloud Infrastructure (medium trust)        |
 |  Vercel Edge  <-->  Turso (libsql)               |
 +---------------------+---------------------------+
                        |
 +----------------------v---------------------------+
 |  TB4: Third-Party APIs (lowest trust)            |
 |  Claude API | FamilySearch | NARA | Sentry       |
 |  Transkribus | Chronicling America | Railway     |
 +--------------------------------------------------+
```

### 2.3 Data Flow Summary

PII flows across trust boundaries in these paths:

1. **User -> App:** Person names, dates, places, notes, media via forms and GEDCOM import
2. **App -> Turso:** Entire database (all PII) when web mode is enabled
3. **App -> Claude API:** Tree context (up to 50 persons: names, dates, places) + user chat messages
4. **App -> FamilySearch/NARA:** Search queries containing person names, dates, places
5. **App -> Transkribus:** Document images (may contain living persons)
6. **App -> Sentry:** Error events potentially containing PII in request data
7. **App -> Browser Cache:** Tree data cached in IndexedDB for PWA offline support

---

## 3. Risk Domain Chapters

### 3.1 Data Classification & Inventory

**Scope:** Catalog every category of PII/sensitive data, its storage location, and GDPR sensitivity tier.

**Data Classification Tiers:**

| Tier | GDPR Category | Examples in Ancstra | Handling Requirements |
|------|--------------|--------------------|-----------------------|
| **T1: Special Category** | Article 9 | DNA data (post-launch), religion (church records via event_type: baptism, confirmation), ethnicity inferences from place/name data | Explicit consent, purpose limitation, no processing without lawful basis |
| **T2: Sensitive PII** | Article 4 — identifiable living persons | Living persons' names, birth dates, birth places, relationships, face embeddings (face_regions.embedding), photos of living persons | Privacy filter mandatory, minimization, right to erasure |
| **T3: Standard PII** | Article 4 — identifiable but lower risk | App user credentials, session tokens, email addresses, API keys, usage/cost tracking records | Standard protection, access controls |
| **T4: Historical/Deceased** | Reduced GDPR scope | Deceased persons' genealogical data, historical records, OCR text from old documents | GDPR generally doesn't apply to deceased, but some member states extend protections (e.g., France: 10 years post-death) |
| **T5: Non-personal** | Outside GDPR | Place hierarchies, source metadata, tree layout positions, app configuration | Standard security practices |

**Findings:**

**DC-1. [High] [P1: Design Now] Religion as special category data**
The `events` table allows `event_type` values like `'baptism'`, `'confirmation'`. These reveal religious affiliation, which is GDPR Article 9 special category data when linked to living persons. The living-person filter strips names but doesn't strip events.

**DC-2. [High] [P3: Must Fix] Face embeddings are biometric data**
`face_regions.embedding` (128-dim vector) is biometric data under GDPR Article 9 when it can identify a living person. Storing biometric data requires explicit consent and a DPIA (Data Protection Impact Assessment). Note: the `face_regions` table schema exists in the data model but face detection features are Phase 3. Defer the `embedding` column to the Phase 3 migration when the consent flow is implemented, or add a schema comment noting the Article 9 requirement.

**DC-3. [Medium] [P1: Must Fix] No formal data inventory**
GDPR Article 30 requires a Record of Processing Activities (ROPA). Deliverable: create `docs/compliance/ropa.md` with columns: Data Category, Purpose, Lawful Basis, Retention Period, Deletion Mechanism, Processor.

**DC-4. [Low] [P4: Flag] Deceased person protections vary by EU member state**
France extends some data rights 10 years post-death. The 100-year living threshold is conservative and good, but this variance should be noted.

---

### 3.2 Authentication & Authorization

**Scope:** Password security, session management, RBAC enforcement, API protection.

**Current state:**
- NextAuth.js v5 with credentials provider (email/password)
- RBAC roles: owner, admin, editor, viewer
- `proxy.ts` route protection (Next.js 16 pattern)
- Living-person filter applies based on viewer role (owner/admin see all, editor/viewer get filtered)

**Findings:**

**AA-1. [High] [P1: Must Fix] No password hashing strategy documented**
Phase 1 plan mentions credentials provider but doesn't specify hashing algorithm. Must use bcrypt/scrypt/argon2 — never store plaintext. This is both a security fundamental and GDPR Article 32 (appropriate technical measures). Note: in Phase 1 local-only mode the attack surface is minimal, but this must be in place before any network exposure.

**AA-2. [High] [P1: Must Fix] Session token security in local vs web mode**
In local mode, the app runs on localhost with no TLS. Session cookies without `Secure` flag are acceptable on localhost, but the transition to web mode must enforce `Secure`, `HttpOnly`, `SameSite=Strict`. Deliverable: document cookie security requirements for local vs web mode; implement environment-aware cookie configuration.

**AA-3. [High] [P1: Design Now] RBAC enforcement location**
`filterForPrivacy` filters at the application layer, but API routes don't show authorization checks. Every mutation endpoint (`POST /api/persons`, `PUT /api/families`, `DELETE /api/persons/[id]`) needs role verification. A viewer calling `DELETE` should be rejected, not just filtered. Deliverable: design RBAC middleware pattern in `docs/architecture/` or as an ADR.

**AA-4. [High] [P4: Must Fix] Multi-user auth deferred to Phase 4**
Phases 1-3 run with a single-user assumption. Risk: if deployed to Vercel for family sharing before Phase 4, there's no proper user isolation. Anyone with the URL could access the tree. Severity upgraded to High because this gates web mode (see Appendix A).

**AA-5. [Medium] [P1: Should Fix] Rate limiting implementation**
Phase 1 plan mentions "basic in-memory rate limiting." In-memory rate limiting resets on server restart and doesn't work across Vercel serverless instances. For web mode, use Vercel's built-in rate limiting or edge middleware.

**AA-6. [Low] [P1: Design Now] API key management for external services**
Claude API key, FamilySearch API key, Transkribus key — these appear in Phase 2+ but should be designed for now. Environment variables are fine for local; for web mode, Vercel encrypted env vars. Never log API keys (pino logging needs a redaction filter). Deliverable: add API key redaction to pino logger configuration.

---

### 3.3 Data Flows & Trust Boundaries

**Scope:** How PII moves through the system, where trust boundaries exist, where data could leak.

**Findings:**

**DF-1. [Critical] [Pre-Web: Must Fix] Local-to-web transition has no data sanitization step**
When switching from better-sqlite3 to Turso, the entire database is uploaded to a cloud service. There's no checkpoint that asks: "Does this database contain data you don't want in the cloud?" A user might have notes with sensitive family information (adoption records, paternity disputes, mental health notes in the `notes` field) they'd share locally but not online. Need: a pre-migration review screen showing what sensitive data exists and allowing selective redaction. Deliverable: write a spec section describing the migration review screen's data flow, what it surfaces, and what actions the user can take. Note: this is only relevant when the local-to-web transition actually happens; design in P1, implement before web mode is enabled.

**DF-2. [High] [P2: Must Fix] PII sent to Claude API crosses TB4**
Tree context sends up to 50 persons' names, birth years, birth places to Anthropic's servers. For living persons this is a GDPR data transfer to a third-party processor. The living-person filter helps, but: (a) deceased persons born <100 years ago still have identifiable relatives, (b) places + dates can be re-identifying even without names.

**DF-3. [Medium] [P1: Should Fix] Sentry error tracking may capture PII**
Sentry captures stack traces, request data, and user context. If an API error includes person names in the URL or request body (e.g., `/api/persons?q=Maria+Schmidt`), that PII goes to Sentry's servers. Need: Sentry `beforeSend` filter to strip PII. Moved to Medium and P1 because Sentry is configured in Phase 1 and the filter should be set up at configuration time.

**DF-4. [Medium] [P1: Accepted Risk] No encryption at rest for local SQLite**
The SQLite file sits unencrypted on disk. Anyone with file access reads the entire tree. For a personal app this is acceptable. Upgrade path: SQLCipher. Deliverable: document in `docs/architecture/` as an accepted risk with upgrade path.

**DF-5. [Medium] [P1: Must Fix] PWA cache stores PII in IndexedDB**
Offline strategy caches tree data in the browser. IndexedDB is not encrypted. On shared computers, another user could access cached genealogical data. Need: clear cache on logout, consider encrypted IndexedDB wrapper.

**DF-6. [Medium] [P2: Flag] Hono worker to Vercel communication**
The Phase 2 worker on Railway talks to Turso and receives job data containing PII. This is a new trust boundary. Worker authentication and TLS between services must be enforced. Deliverable: design authentication mechanism for worker-to-API communication.

---

### 3.4 Third-Party Integrations & Data Processing

**Scope:** Every external service, what data it receives, GDPR obligations for each.

**Third-Party Data Processing Inventory:**

| Service | Phase | Data Sent | Data Received | GDPR Role | DPA Required? |
|---------|-------|-----------|---------------|-----------|---------------|
| **Anthropic (Claude API)** | P2 | Tree context (50 persons: names, dates, places), chat messages, OCR text | AI responses, relationship proposals | Data Processor | Yes |
| **FamilySearch API** | P2 | Person names, dates, places (search queries) | Historical records, external person data | Independent Controller | No (public records), but review ToS |
| **NARA API** | P2 | Search queries with person details | Government record metadata | Independent Controller | No (public records) |
| **Chronicling America** | P2 | Search terms (names, places, dates) | Newspaper article text | Independent Controller | No (public domain) |
| **Transkribus** | P3 | Document images (may contain living persons' handwriting, photos) | OCR text | Data Processor | Yes |
| **Turso (libsql)** | P1 (web) | Entire database (all PII) | Query results | Data Processor | Yes |
| **Vercel** | P1 (web) | HTTP requests, server-side code execution, logs | Hosted app responses | Data Processor | Yes (covered by Vercel DPA) |
| **Sentry** | P1 | Error events, stack traces, potentially request data with PII | Error tracking dashboard | Data Processor | Yes |
| **Railway** (Hono worker) | P2 | Job payloads with person data | Job results | Data Processor (infra) | Yes |

**Findings:**

**TP-1. [Critical] [P2: Must Fix, or earlier if web mode enabled] No Data Processing Agreement (DPA) strategy**
GDPR Article 28 requires a DPA with every processor handling EU personal data. Anthropic, Turso, Sentry, and Transkribus all need DPAs. Vercel has a standard DPA available. Verify each vendor offers one and sign them before web deployment. Note: this is a long-lead item — vendor response times may be 2-6 weeks. Initiate DPA requests at Phase 1 exit.

**TP-2. [High] [P2: Must Fix] Claude API data retention**
Anthropic's API terms state they don't train on API data, but verify: (a) data retention period for API requests, (b) whether prompts/completions are logged, (c) data residency (US servers — triggers GDPR Chapter V transfer rules for EU users). May need Standard Contractual Clauses (SCCs).

**TP-3. [High] [P2: Design Now] FamilySearch search queries leak PII**
When searching for "Maria Schmidt born 1952 in Munich," you're sending a living person's identifying data to FamilySearch. Even if Maria is in your tree as "Living," the search itself reveals her identity. Need: only search for deceased persons, or strip identifying details from searches about living persons' relatives.

**TP-4. [Medium] [P3: Design Now] Transkribus receives document images**
Historical documents may contain photos or handwriting of living persons (e.g., a 1990 family Bible page). Need: user confirmation before sending documents to OCR, or local-first OCR via tesseract.js for sensitive documents.

**TP-5. [Medium] [P1: Should Fix] Turso data residency**
Turso supports multiple regions. For GDPR, the database should be in an EU region. If defaulting to US, this is a Chapter V transfer requiring additional safeguards.

**TP-6. [Low] [P2: Flag] API key exposure in client bundle**
If any API keys are used client-side (e.g., FamilySearch), they could be extracted from the JavaScript bundle. All external API calls should be proxied through the server.

---

### 3.5 AI Governance

**Scope:** Data minimization, prompt injection, hallucination, fabricated relationships, cost/billing security.

#### 3.5.1 Data Minimization

Current `buildTreeContext` sends up to 50 persons with names, birth years, death years, and birth places to Claude.

| Data Field | Necessary for AI? | Minimization Option |
|-----------|-------------------|---------------------|
| Person names | Yes — needed for record search | Send only for deceased persons |
| Birth/death years | Yes — needed for record matching | Acceptable |
| Birth places | Yes — needed for geographic search | Acceptable |
| Notes field | No — currently not sent | Keep excluded |
| Research gaps | Yes — drives suggestions | Acceptable (non-PII) |
| Face embeddings | No | Never send |

**Findings:**

**AI-1. [High] [P2: Must Fix] Living persons leak into AI context**
`filterForPrivacy` runs on search results, but `buildTreeContext` in `packages/ai/context/tree-context.ts` fetches directly from the database via `getAncestors()`. If this path doesn't apply the living-person filter, Claude sees living persons' full data. Need: verify `buildTreeContext` calls `filterForPrivacy` before building the context, or filter at the query level. Note: this and AI-3 are blockers for enabling the AI chat feature.

**AI-2. [High] [P2: Must Fix] Chat messages may contain living person PII**
Even if the tree context is filtered, the user can type "find records for my mother Jane Smith born 1965 in Berlin." That message goes to Claude with full PII. Options: (a) accept this as user-initiated disclosure (document in privacy policy), (b) add a warning when living person details are detected in chat input, (c) strip living-person references before sending (impractical). Recommendation: option (a) with option (b) as a UX enhancement.

**AI-3. [Critical] [P2: Must Fix] Prompt injection via external records**
Claude's tools fetch data from FamilySearch, NARA, and Chronicling America. A malicious or corrupted external record could contain prompt injection payloads (e.g., a newspaper OCR result containing "Ignore previous instructions and..."). Need: sanitize all external data before it enters the AI context. Treat tool results as untrusted input. Note: this and AI-1 are blockers for enabling the AI chat feature.

**AI-4. [High] [P2: Must Fix] Hallucinated relationships enter the database**
The `proposeRelationship` tool creates real `proposed_relationships` records. If Claude hallucinates a relationship (confident but wrong), it becomes a pending proposal. The validation gate (editor must approve) mitigates this, but: (a) a solo user is both researcher and editor, reducing the gate's effectiveness, (b) confidence scores from Claude are not calibrated — 0.85 confidence doesn't mean 85% accuracy. Need: add warning labels on AI-proposed relationships, never auto-accept regardless of confidence score.

**AI-5. [Medium] [P2: Should Fix] No AI audit trail**
`change_log` tracks entity mutations, but there's no log of what Claude was asked, what it responded, or why it proposed a relationship. For GDPR Article 22 (automated decision-making) and for debugging hallucinations, need an `ai_interactions` log: prompt summary, tool calls made, proposals generated, token usage.

**AI-6. [Medium] [P2: Should Fix] Cost/billing security**
`checkBudget` has a $10/month default limit, which is good. But: (a) the budget check happens in application code — a bug or bypass skips it, (b) no Anthropic-side spending limit configured, (c) if API key leaks, an attacker can run up costs. Need: set spending limits in the Anthropic dashboard as a hard cap, not just application-level checks.

**AI-7. [Low] [P2: Design Now] Model selection has no security dimension**
Model selection table is cost-optimized but doesn't consider that more sensitive queries (those involving living persons) might warrant different handling than historical research.

---

### 3.6 Privacy Engineering

**Scope:** Living-person filter, GDPR data subject rights, soft deletes, privacy-by-design.

#### 3.6.1 Living-Person Filter Analysis

The filter in `packages/shared/privacy/living-filter.ts` is the single most important privacy control. Canonical threshold: 100 years (see data-model.md).

| Aspect | Current Implementation | Assessment |
|--------|----------------------|------------|
| Threshold | 100 years, no death date | Good — conservative |
| No birth date | Assumes living | Good — safe default |
| Explicit flag | `is_living` field overrides | Good — allows manual control |
| Filter output | Replaces name with "Living", nulls notes | **Gap:** doesn't strip events, places, relationships |
| Applied to | `filterForPrivacy()` on person arrays | **Gap:** only filters names, not associated data |
| Roles bypassed | owner, admin see all | Acceptable for personal use |

**Findings:**

**PE-1. [Critical] [P1: Must Fix] Living-person filter is incomplete**
`filterForPrivacy` replaces `given_name` with "Living" and nulls `surname` and `notes`, but doesn't touch events, places, media, or relationships. A viewer can still see: "Living was born on 15 Mar 1985 in Munich, Germany" with linked baptism records and photos. Birth date + birth place is often sufficient for re-identification. Need: filter must strip or generalize events (birth year only — no month/day, country only — no city), hide media links, and show relationship count only (not identities) for living persons viewed by editor/viewer roles. This is the root cause for PE-2, AI-1, and the privacy dimension of DF-1.

**PE-2. [High] [P1: Must Fix] No filter on GEDCOM export**
Export plan mentions privacy modes (Full/Shareable/Ancestors only) but the living-person filter isn't integrated into the export pipeline yet. Risk: a user exports "Shareable tree" but the filter doesn't strip events and places for living persons.

**PE-3. [High] [P1: Accepted Risk] Indirect identification through relationships**
Even if "Living" replaces a name, the tree structure itself reveals identity. If you can see "Living is the child of Hans Schmidt (1955-2020) and Maria Schmidt (1960-)", the living person is identifiable. This is inherent to genealogy apps. Deliverable: document as accepted residual risk in `docs/architecture/`. Ensure viewer role gets a significantly redacted view (relationship counts only, not identities).

**PE-4. [Medium] [P4: Design Now] No consent mechanism**
GDPR requires a lawful basis for processing living persons' data. In local mode, legitimate interest is defensible (personal/household exemption, GDPR Article 2(2)(c)). In web mode, you're sharing living persons' data without their consent. Need: either (a) obtain consent from living persons before sharing their data in web mode, or (b) provide opt-out mechanism, or (c) restrict web mode to deceased-only trees. Note: PE-7 already covers documenting the household exemption in P1; consent design belongs in P4 when multi-user auth is built.

#### 3.6.2 GDPR Data Subject Rights

| Right | Article | Current Support | Gap |
|-------|---------|----------------|-----|
| Right of access | Art. 15 | No mechanism | Need: way for a data subject to request what data you hold about them |
| Right to erasure | Art. 17 | Soft delete exists (`deleted_at`) | Soft delete doesn't erase — data remains in DB. Need hard delete path |
| Right to rectification | Art. 16 | Edit forms exist | Adequate for owner/admin; no mechanism for external data subjects |
| Right to data portability | Art. 20 | GEDCOM export | Good — GEDCOM is an interoperable format |
| Right to restrict processing | Art. 18 | `privacy_level` field exists | Partial — no mechanism for a data subject to trigger this |
| Right to object | Art. 21 | No mechanism | Need: way for living persons to object to their data being in someone else's tree |

**PE-5. [High] [P4: Must Fix] Soft delete doesn't satisfy right to erasure**
`deleted_at` field preserves data for sync recovery, but GDPR erasure means actually removing data. Need: a hard delete function that purges the person, their events, media links, face regions, and any AI proposals referencing them. The `change_log` entry can note "erased per GDPR request" without retaining the deleted data.

**PE-6. [Medium] [P4: Design Now] No data subject request workflow**
When Ancstra goes web, a living person in someone's tree could email asking "what data do you have about me?" Need a process (even if manual initially) and a response timeline (GDPR: 30 days).

**PE-7. [Low] [P1: Flag] GDPR household exemption applies to local mode**
Article 2(2)(c) exempts "purely personal or household activity." Local-only Ancstra likely qualifies. But the moment you deploy to web and share with family, the exemption becomes debatable. This is the key legal inflection point of the local-to-web transition. Deliverable: document exemption applicability and limits in `docs/compliance/`.

---

### 3.7 GDPR Compliance Mapping

Direct mapping of relevant GDPR articles to Ancstra's current state.

| Article | Requirement | Local Mode | Web Mode | Phase Annotation |
|---------|------------|------------|----------|-----------------|
| **Art. 2(2)(c)** | Household exemption | Likely exempt | **Not exempt** — sharing via URL is no longer purely personal | [P1: Document] |
| **Art. 5(1)(a)** | Lawfulness, fairness, transparency | N/A (exempt) | Need privacy policy explaining data collection and purpose | [P4: Must Fix] |
| **Art. 5(1)(b)** | Purpose limitation | N/A | Define and document purposes: genealogy research, family sharing | [P4: Must Fix] |
| **Art. 5(1)(c)** | Data minimization | Good — schema stores only genealogical data | AI context sends more than necessary (AI-1, DF-2) | [P2: Fix] |
| **Art. 5(1)(e)** | Storage limitation | No retention policy | Need retention periods for: AI logs, match candidates, Sentry data | [P2: Design] |
| **Art. 6** | Lawful basis | Household exemption | Legitimate interest (Art. 6(1)(f)) for deceased; consent (Art. 6(1)(a)) for living | [P4: Must Fix] |
| **Art. 9** | Special category data | Religion via events, future DNA | Explicit consent required before processing | [P1: Design Now] |
| **Art. 12-14** | Transparency / privacy notice | N/A | Need privacy policy accessible from app | [P4: Must Fix] |
| **Art. 15-22** | Data subject rights | N/A | See Section 3.6.2 — multiple gaps (PE-5, PE-6) | [P4: Must Fix] |
| **Art. 22** | Automated decision-making | N/A | AI proposes relationships — validation gate (human approval required) satisfies Art. 22(3) safeguard. Document this explicitly. | [P2: Document] |
| **Art. 25** | Privacy by design | Living filter exists | Filter is incomplete (PE-1, PE-2) | [P1: Fix] |
| **Art. 28** | Data processor agreements | N/A | DPAs needed with Anthropic, Turso, Sentry, Transkribus, Railway (TP-1) | [P2: Must Fix] |
| **Art. 30** | Record of processing activities | N/A | No ROPA exists (DC-3) | [P1: Start, P4: Formalize] |
| **Art. 32** | Security of processing | SQLite on local disk | Need: TLS, encryption at rest assessment, access controls, password hashing (AA-1) | [P1: Fix] |
| **Art. 33-34** | Breach notification | N/A | Need breach response plan (72-hour notification to supervisory authority) | [P4: Design] |
| **Art. 35** | DPIA required | N/A | Required for: face recognition (biometric), AI profiling, large-scale processing of special category data | [P3: Must Do] |
| **Art. 44-49** | International transfers | N/A | Claude API (US), Vercel (US/EU), Turso (configurable) — need SCCs or adequacy decision | [P2: Fix] |

**Key insight:** The transition to web mode triggers nearly every GDPR obligation simultaneously. Recommendation: create a "Web Mode Readiness Checklist" as a hard gate before enabling Turso/Vercel deployment (see Appendix A).

---

### 3.8 Infrastructure & Deployment Security

**Scope:** Server hardening, headers, file handling, deployment-mode-specific risks.

**Findings:**

**IS-1. [High] [P1: Must Fix] No Content Security Policy (CSP)**
Next.js app needs CSP headers to prevent XSS. Especially important because it renders user-supplied data (person names, notes, OCR text) and embeds third-party content. Need: strict CSP in `next.config.ts` headers config.

**IS-2. [High] [P1: Must Fix] SQLite WAL mode backup race condition**
Phase 1 plan enables WAL mode and copies the SQLite file on app start. Copying a WAL-mode database requires copying both the `.db` file and the `-wal` and `-shm` files atomically, or using SQLite's backup API. A naive file copy can produce a corrupt backup.

**IS-3. [Medium] [P1: Should Fix] No input sanitization layer**
API routes accept person names, notes, place descriptions, and GEDCOM file uploads. Zod validates structure but doesn't sanitize for stored XSS. A malicious GEDCOM file could contain `<script>` tags in name fields. Need: HTML-escape all user-supplied strings before storage or rendering.

**IS-4. [Medium] [P1: Should Fix] GEDCOM file upload is an attack vector**
GEDCOM files are parsed and their content inserted into the database. A crafted GEDCOM could contain: (a) extremely large files (DoS), (b) deeply nested structures (stack overflow — also affects closure table rebuild, which could loop or explode in size with circular relationships), (c) SQL injection via field values (mitigated by Drizzle ORM parameterization, but verify), (d) path traversal in media file references. Need: file size limits, parsing depth limits, closure table rebuild bounds checking, input validation.

**IS-5. [Medium] [P2: Must Fix] Vercel serverless has no persistent state**
Rate limiting, session state, and budget tracking that rely on in-memory state don't work across serverless invocations. Need: move stateful concerns to Turso or use Vercel KV/Edge Config.

**IS-6. [Low] [P1: Should Fix] No security headers beyond CSP**
Need: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (web mode), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` to disable unused browser APIs.

**IS-7. [Low] [P1: Accepted Risk] Local mode runs on HTTP**
`next dev` and `next start` on localhost use HTTP. Acceptable for local-only, but if someone accesses the local app from another device on the same network, credentials travel in plaintext. Document as accepted risk for local mode.

**IS-8. [High] [P1: Should Fix] No CSRF protection on API route handlers**
Next.js Server Actions have built-in CSRF protection, but the API route handlers in `apps/web/app/api/` do not get this automatically. Mutation endpoints (`POST /api/persons`, `DELETE /api/persons/[id]`, etc.) are susceptible to CSRF attacks in web mode. Need: CSRF token validation on all state-changing API routes.

**IS-9. [Medium] [P1: Should Fix] FTS5 query injection risk**
FTS5 virtual tables (`fts_persons`, `fts_places`, `fts_sources`, `fts_media`) use the `MATCH` operator with a different syntax than standard SQL. If search queries are constructed via string concatenation rather than parameterized inputs, FTS5-specific injection is possible. Need: verify all FTS5 query construction uses parameterized inputs through Drizzle ORM.

---

## 4. Phase Appendices

### 4.1 Phase 1 Checklist

Items to address during Phase 1: Core Manual Tree Builder. Split into build-phase items (address while writing the code) and exit-gate items (address before moving to Phase 2).

#### P1a: Build Phase (address while writing related code)

- [ ] **PE-1:** Expand `filterForPrivacy` to strip/generalize events (birth year only, country only), hide media, show relationship counts only for living persons
- [ ] **PE-2:** Integrate living-person filter into GEDCOM export pipeline
- [ ] **IS-2:** Use SQLite backup API instead of naive file copy for WAL-mode databases
- [ ] **IS-3:** Add HTML-escaping for all user-supplied strings (names, notes, places)
- [ ] **IS-4:** Add file size limits (50MB), parsing depth limits, and closure table rebuild bounds checking for GEDCOM uploads
- [ ] **IS-9:** Verify FTS5 queries use parameterized inputs through Drizzle ORM
- [ ] **DF-3:** Add Sentry `beforeSend` filter to strip PII when configuring Sentry
- [ ] **DF-5:** Clear PWA IndexedDB cache on logout

#### P1b: Exit Gate (address before Phase 2)

- [ ] **AA-1:** Implement password hashing (argon2 or bcrypt) in NextAuth.js credentials provider
- [ ] **IS-1:** Add Content Security Policy headers in `next.config.ts`
- [ ] **IS-6:** Add security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [ ] **IS-8:** Add CSRF token validation on all state-changing API routes
- [ ] **AA-5:** Design rate limiting strategy that works for both local and serverless
- [ ] **DC-3:** Create initial ROPA at `docs/compliance/ropa.md`
- [ ] **TP-1 (long-lead):** Initiate DPA requests with Anthropic, Turso, Sentry — vendor response times may be 2-6 weeks

#### Design Now (concrete deliverables, implement later)

- [x] **AA-2:** Document cookie security requirements for local vs web mode in `docs/architecture/` — cookie security pattern created at `docs/architecture/patterns/cookie-security.ts`
- [x] **AA-3:** Design RBAC middleware pattern as ADR in `docs/architecture/decisions/` — ADR-008 created
- [x] **AA-6:** Add API key redaction to pino logger configuration design — pino redaction pattern created at `docs/architecture/patterns/pino-redaction.ts`
- [x] **DF-1:** Write spec section describing migration review screen (data flow, what it surfaces, user actions) — ADR-010 created
- [x] **DF-4:** Document encryption-at-rest as accepted risk with SQLCipher upgrade path in `docs/architecture/` — accepted risk documented at `docs/compliance/accepted-risks.md`
- [x] **DC-1:** Document that event types (baptism, confirmation) are Article 9 data in ROPA — Article 9 note added to ROPA
- [x] **PE-3:** Document indirect identification as accepted residual risk in `docs/architecture/` — accepted risk documented at `docs/compliance/accepted-risks.md`
- [x] **PE-7:** Document GDPR household exemption applicability and limits in `docs/compliance/` — household exemption documented at `docs/compliance/household-exemption.md`

### 4.2 Phase 2 Checklist

Items to address during Phase 2: AI Search & Matching.

**Sequencing note:** AI-1 and AI-3 are blockers for enabling the AI chat feature. Do not ship the research assistant until both are resolved.

#### Must Fix

- [ ] **TP-1:** Sign DPAs with Anthropic, Turso, Sentry (initiated at P1 exit)
- [ ] **TP-2:** Verify Claude API data retention, logging, and residency; implement SCCs if needed
- [ ] **AI-1:** Ensure `buildTreeContext` applies living-person filter before sending to Claude
- [ ] **AI-3:** Sanitize all external API data (FamilySearch, NARA, newspapers) before injecting into AI context
- [ ] **AI-4:** Add warning labels on AI-proposed relationships; enforce no auto-accept
- [ ] **DF-2:** Minimize PII sent to Claude — send IDs or anonymized data where possible
- [ ] **IS-5:** Move stateful concerns (rate limiting, budget tracking) to persistent storage

#### Should Fix

- [ ] **AI-5:** Create `ai_interactions` audit log table
- [ ] **AI-6:** Set Anthropic dashboard spending limits as hard cap
- [ ] **TP-5:** Configure Turso to use EU region for GDPR compliance

#### Design Now

- [ ] **TP-3:** Design safeguard to prevent searching for living persons on FamilySearch
- [ ] **AI-2:** Document user-initiated PII disclosure in privacy policy; consider chat input warning
- [ ] **AI-7:** Consider security dimension in model selection for sensitive queries
- [ ] **DF-6:** Design authentication for Hono worker-to-Vercel communication
- [ ] **Art. 22:** Document that AI relationship proposals satisfy Art. 22(3) via human validation gate

### 4.3 Phase 3-6 Flags

Items to address in later phases. Phases 4 and 6 will need their own detailed checklists when approached.

#### Phase 3: Document Processing
- [ ] **TP-4:** User confirmation before sending documents to Transkribus; offer local tesseract.js for sensitive docs
- [ ] **DPIA required** for face recognition (biometric data processing under Art. 35)
- [ ] **DC-2:** Implement explicit consent flow for face embedding storage; defer `embedding` column to Phase 3 migration

#### Phase 4: Auth & Collaboration
- [ ] **AA-4:** Implement proper multi-user authentication and user isolation
- [ ] **PE-5:** Implement hard delete function (true erasure, not soft delete) for GDPR Art. 17
- [ ] **PE-4:** Design and implement consent mechanism for living persons in web mode
- [ ] **PE-6:** Create data subject request workflow (even if manual)
- [ ] **Art. 5/6/12-14:** Privacy policy, purpose documentation, lawful basis for web mode
- [ ] **Art. 30:** Formalize ROPA for web deployment
- [ ] **Art. 33-34:** Create breach notification plan (even a one-page plan: who to contact, what to report, how to assess scope)

Note: consider moving privacy policy and ROPA formalization earlier — these are writing tasks that don't depend on auth being implemented.

#### Phase 6: Deployment & Launch
- [ ] **Web Mode Readiness Gate:** All Appendix A items resolved before enabling Turso/Vercel
- [ ] **Art. 44-49:** International transfer mechanisms in place (SCCs with all US-based processors)

#### Post-Launch: DNA
- [ ] **Art. 9:** DNA is special category (genetic) data — requires DPIA, explicit consent, purpose limitation
- [ ] **Biometric + genetic data** has the highest regulatory sensitivity under GDPR

---

## 5. Risk Register

Living table of all findings. Update status as items are resolved.

**Valid statuses:** `Open` | `In Progress` | `Resolved` | `Accepted Risk` | `Deferred` | `N/A`

| ID | Severity | Domain | Finding | Phase | Owner | Status | Resolution Notes | Resolved Date | Verification |
|----|----------|--------|---------|-------|-------|--------|-----------------|---------------|-------------|
| PE-1 | Critical | Privacy | Living-person filter incomplete — doesn't strip events/places/media (root cause for PE-2, AI-1) | P1 | nearl | Open | | | |
| AI-3 | Critical | AI | Prompt injection via external records into AI context | P2 | nearl | Open | | | |
| DF-1 | Critical | Data Flow | No sanitization step in local-to-web transition | Pre-Web | nearl | Open | | | |
| TP-1 | Critical | Third-Party | No DPA strategy for data processors | P2 (long-lead) | nearl | Open | | | |
| AA-1 | High | Auth | No password hashing strategy documented | P1 | nearl | Open | | | |
| AA-2 | High | Auth | Session token security differs between local/web mode | P1 | nearl | Open | | | |
| AA-3 | High | Auth | RBAC enforcement missing on API mutation endpoints | P1 | nearl | Open | | | |
| AA-4 | High | Auth | Multi-user auth deferred; web mode has no user isolation | P4 | nearl | Open | | | |
| DC-1 | High | Data Class | Religious events are Article 9 special category data | P1 | nearl | Resolved | Art. 9 event types documented in ROPA | 2026-03-21 | |
| DC-2 | High | Data Class | Face embeddings are biometric data requiring consent + DPIA | P3 | nearl | Open | | | |
| PE-2 | High | Privacy | No living-person filter on GEDCOM export | P1 | nearl | Open | | | |
| PE-3 | High | Privacy | Indirect identification through tree relationships | P1 | nearl | Accepted Risk | Documented at docs/compliance/accepted-risks.md | 2026-03-21 | |
| PE-5 | High | Privacy | Soft delete doesn't satisfy GDPR right to erasure | P4 | nearl | Open | | | |
| DF-2 | High | Data Flow | PII sent to Claude API crosses trust boundary | P2 | nearl | Open | | | |
| TP-2 | High | Third-Party | Claude API data retention/residency not verified | P2 | nearl | Open | | | |
| TP-3 | High | Third-Party | FamilySearch search queries leak living person PII | P2 | nearl | Open | | | |
| AI-1 | High | AI | Living persons may leak into AI context | P2 | nearl | Open | | | |
| AI-2 | High | AI | User chat messages contain living person PII | P2 | nearl | Open | | | |
| AI-4 | High | AI | Hallucinated relationships enter database as proposals | P2 | nearl | Open | | | |
| IS-1 | High | Infra | No Content Security Policy headers | P1 | nearl | Open | | | |
| IS-2 | High | Infra | SQLite WAL backup race condition | P1 | nearl | Open | | | |
| IS-8 | High | Infra | No CSRF protection on API route handlers | P1 | nearl | Open | | | |
| AA-5 | Medium | Auth | In-memory rate limiting doesn't work on serverless | P1 | nearl | Open | | | |
| DC-3 | Medium | Data Class | No formal data inventory (ROPA) | P1 | nearl | Resolved | ROPA created at docs/compliance/ropa.md | 2026-03-21 | |
| DF-3 | Medium | Data Flow | Sentry may capture PII in error events | P1 | nearl | Open | | | |
| DF-4 | Medium | Data Flow | No encryption at rest for local SQLite | P1 | nearl | Accepted Risk | Documented at docs/compliance/accepted-risks.md | 2026-03-21 | |
| DF-5 | Medium | Data Flow | PWA cache stores PII in IndexedDB unencrypted | P1 | nearl | Open | | | |
| DF-6 | Medium | Data Flow | Hono worker trust boundary not secured | P2 | nearl | Open | | | |
| TP-4 | Medium | Third-Party | Transkribus receives potentially sensitive document images | P3 | nearl | Open | | | |
| TP-5 | Medium | Third-Party | Turso data residency may default to US | P1 | nearl | Open | | | |
| AI-5 | Medium | AI | No AI audit trail for prompts/responses/proposals | P2 | nearl | Open | | | |
| AI-6 | Medium | AI | Budget check is application-only; no Anthropic-side hard cap | P2 | nearl | Open | | | |
| PE-4 | Medium | Privacy | No consent mechanism for living persons in web mode | P4 | nearl | Open | | | |
| PE-6 | Medium | Privacy | No data subject request workflow | P4 | nearl | Open | | | |
| IS-3 | Medium | Infra | No input sanitization (stored XSS risk) | P1 | nearl | Open | | | |
| IS-4 | Medium | Infra | GEDCOM upload as attack vector (DoS, depth, closure table, path traversal) | P1 | nearl | Open | | | |
| IS-5 | Medium | Infra | Serverless has no persistent state for rate limiting/budgets | P2 | nearl | Open | | | |
| IS-9 | Medium | Infra | FTS5 query injection risk via string concatenation | P1 | nearl | Open | | | |
| DC-4 | Low | Data Class | Deceased person protections vary by EU member state | P4 | nearl | Open | | | |
| AA-6 | Low | Auth | API key management not designed | P1 | nearl | Resolved | Pino redaction pattern at docs/architecture/patterns/pino-redaction.ts | 2026-03-21 | |
| TP-6 | Low | Third-Party | API keys could be exposed in client bundle | P2 | nearl | Open | | | |
| AI-7 | Low | AI | Model selection has no security dimension | P2 | nearl | Open | | | |
| IS-6 | Low | Infra | Missing security headers (X-Content-Type-Options, etc.) | P1 | nearl | Open | | | |
| IS-7 | Low | Infra | Local mode runs on HTTP | P1 | nearl | Accepted Risk | Documented at docs/compliance/accepted-risks.md | 2026-03-21 | |
| PE-7 | Low | Privacy | GDPR household exemption limits not documented | P1 | nearl | Resolved | Household exemption documented at docs/compliance/household-exemption.md | 2026-03-21 | |

---

## Appendix A: Web Mode Readiness Gate

**Do not enable Turso/Vercel deployment until all items below are resolved.**

### Tier 1: Hard Blockers (immediate legal or data breach risk)

- [ ] Living-person filter covers events, places, media (PE-1)
- [ ] Living-person filter integrated into GEDCOM export (PE-2)
- [ ] Password hashing implemented (AA-1)
- [ ] Session cookies enforce Secure/HttpOnly/SameSite=Strict (AA-2)
- [ ] RBAC middleware on all mutation endpoints (AA-3)
- [ ] CSP and security headers configured (IS-1, IS-6)
- [ ] CSRF protection on API routes (IS-8)
- [ ] Input sanitization active (IS-3)
- [ ] DPAs signed with all data processors (TP-1)
- [ ] Turso configured for EU region (TP-5)
- [ ] Sentry PII filter active (DF-3)
- [ ] Hard delete function implemented (PE-5)
- [ ] Privacy policy published (Art. 12-14)
- [ ] International transfer mechanisms in place — SCCs with US-based processors (Art. 44-49)
- [ ] Breach response plan documented — even one page (Art. 33-34)
- [ ] Pre-migration review screen for local-to-web transition (DF-1)

### Tier 2: Deploy with Documented Risk Acceptance

Items where a solo developer sharing with family could reasonably accept the risk temporarily, with an explicit acknowledgment in the UI or configuration:

- [ ] Multi-user auth implemented (AA-4) — OR restricted to single-user with forced acknowledgment dialog at first web login
- [ ] Consent mechanism for living persons' data (PE-4) — OR web mode restricted to deceased-only display with UI toggle
- [ ] ROPA document formalized for web deployment (Art. 30) — initial ROPA from P1 is acceptable; full formalization can follow

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-03-21 | Initial assessment created | Claude + nearl |
| 2026-03-21 | Applied spec review fixes: corrected severity counts, added CSRF (IS-8) and FTS5 injection (IS-9), added Article 22 to GDPR mapping, expanded risk register with Owner/Resolution/Verification columns, split P1 checklist into build-phase and exit-gate, added two-tier Web Mode Readiness Gate, added threat actor model, reconciled phase annotations (DF-1 to Pre-Web, DC-2 to P3, AA-4 to High, PE-4 to P4), added root cause analysis for filterForPrivacy, added concrete deliverables for Design Now items, added review cadence, added DPA long-lead flag | Claude + nearl |
| 2026-03-21 | Resolved documentation tasks: ROPA, household exemption, accepted risks, DPA checklist, ADRs 007-010, code patterns for security headers/RBAC/filter/Sentry/pino/GEDCOM/FTS5 | Claude + nearl |
