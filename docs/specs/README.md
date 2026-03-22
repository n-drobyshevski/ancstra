# Ancstra Design-Level Specifications

Design-level system specifications extracted from the full monolithic spec. Each file covers architecture, requirements, data flows, API surface outlines, and key patterns — condensed implementation code to signatures and patterns rather than full listings.

## Specifications

### [familysearch-api.md](familysearch-api.md)
**Phase: 2 | Source: Section 5 (~400 lines)**

OAuth 2.0 PKCE flow, API client with rate limiting (token bucket), hints engine for record discovery, Phase 2 pull-only sync strategy with conflict resolution via `match_candidates` table, caching strategy, offline queue design.

**Key components:**
- OAuth PKCE flow diagram
- FamilySearchClient with 30 req/min rate limiting
- Hints engine: multi-query search, deduplication, scoring
- Sync metadata (`fs_person_id`, `fs_last_sync`)

### [ai-research-assistant.md](ai-research-assistant.md)
**Phase: 3 | Source: Section 6 (~350 lines)**

Vercel AI SDK integration with Claude tool-calling. System prompt with dynamic tree context, tool definitions (search local/FamilySearch/NARA/newspapers, compute relationship, propose relationships), context injection strategy (~2000 token budget), model selection per task, cost tracking.

**Key components:**
- Architecture diagram (chat → tools → tree context)
- Tool definitions (8 tools with parameter schemas)
- TreeContext structure (summary, key persons, gaps)
- Model pricing table (Haiku/Sonnet/Opus)
- Monthly budget enforcement

### [record-matching.md](record-matching.md)
**Phase: 2 | Source: Section 8 (~150 lines)**

Fellegi-Sunter probabilistic record linkage in TypeScript (no Python). Blocking strategy (surname prefix), name comparison (Jaro-Winkler + nicknames + Soundex), date/place matching, weighted scoring, classification thresholds (0.95+ auto-accept, 0.70-0.95 review, <0.70 reject).

**Key components:**
- Pipeline diagram (blocking → comparison → scoring → classification)
- Nickname map (14 historical variants)
- FIELD_WEIGHTS table (surname 0.25, givenName 0.20, etc.)
- Integration with `proposed_relationships` (not direct modification)
- Upgrade path to Splink via Docker HTTP wrapper

### [document-processing.md](document-processing.md)
**Phase: 3 | Source: Section 7 (~150 lines)**

End-to-end OCR pipeline: preprocessing (Sharp: rotate, grayscale, normalize, sharpen), tesseract.js for printed text, Transkribus REST API for handwriting, Claude entity extraction (persons, events, relationships), review UI, auto-linking via record matching.

**Key components:**
- Architecture pipeline diagram
- Sharp preprocessing steps
- tesseract.js (WASM) and Transkribus (cloud) OCR
- ExtractedEntities structure (persons, events, relationships)
- Integration with record-matching engine

### [photo-analysis.md](photo-analysis.md)
**Phase: 4 | Source: Section 9 (~70 lines)**

Face detection/recognition with face-api.js (TensorFlow.js), face clustering via agglomerative algorithm, cloud enhancement (GFPGAN, Real-ESRGAN, DDColor) via Replicate APIs. Cost tracking for cloud calls.

**Key components:**
- Tool selection table (local vs cloud, costs)
- Face detection with 128-dim embeddings
- Face clustering (cosine similarity >= 0.6)
- Replicate API integration for restoration/upscaling
- Face-to-person linking workflow

### [dna-integration.md](dna-integration.md)
**Phase: 4 | Source: Section 10 (~100 lines)**

DNA data from major providers (23andMe, Ancestry, MyHeritage, FTDNA). File format parsers, encrypted SQLCipher database (separate from genealogy DB), cM-based relationship estimation (DNA Painter reference data), chromosome browser visualization (D3.js).

**Key components:**
- Scope & deferred items (IBD detection, population genetics → Phase 5+)
- Provider file parsers (TSV/CSV formats)
- SQLCipher encrypted storage schema
- cM ranges and relationship estimation
- Chromosome browser design

### [collaboration.md](collaboration.md)
**Phase: 5 | Source: Section 11 (~120 lines, excluding 11.6 relationship validation)**

NextAuth.js authentication (credentials Phase 1, OAuth Phase 5), RBAC permission table (Owner/Admin/Editor/Viewer), multi-tenant architecture (Turso per family), contribution workflow (editors submit, admins review), family invitation flow (7-day JWT tokens), change log auditing.

**Key components:**
- NextAuth.js configuration with JWT strategy
- RBAC permission matrix (8 permissions × 4 roles)
- Turso multi-tenant setup (isolation benefits)
- Contribution workflow diagram
- Family invitation JWT flow
- Change log audit trail

## Architecture References

These specs cross-reference the following architecture documents (assumed to exist):
- `../architecture/data-model.md` - Core data schema (persons, relationships, events, etc.)
- `../architecture/sync-strategy.md` - Phase 2 pull-only, Phase 5 bidirectional
- `../architecture/relationship-validation.md` - Workflow for `proposed_relationships`
- `../architecture/ai-strategy.md` - Shared AI patterns and cost budgets

## Reading Guide

**For implementation:**
1. Start with [familysearch-api.md](familysearch-api.md) for Phase 2 external integration
2. Continue with [record-matching.md](record-matching.md) for Phase 2 core matching engine
3. Move to [document-processing.md](document-processing.md) for Phase 3 OCR workflow
4. Expand with [ai-research-assistant.md](ai-research-assistant.md) for Phase 3 AI features
5. Add [photo-analysis.md](photo-analysis.md) and [dna-integration.md](dna-integration.md) for Phase 4
6. Scale with [collaboration.md](collaboration.md) for Phase 5 multi-user features

**For architecture review:**
- RBAC enforcement: see [collaboration.md](collaboration.md) permission table
- Data flow for hints: [familysearch-api.md](familysearch-api.md) + [record-matching.md](record-matching.md)
- Relationship validation: [ai-research-assistant.md](ai-research-assistant.md) + [collaboration.md](collaboration.md)
- Privacy controls: [collaboration.md](collaboration.md) (Viewer redaction) + [dna-integration.md](dna-integration.md) (encrypted storage)

## Notes

- **Design depth:** Each spec includes architecture decisions, key patterns, and signature examples — not full implementation code
- **Phase alignment:** Specs are tagged with implementation phase (2-5) matching project roadmap
- **Cross-references:** Use relative links to navigate between specs and architecture docs
- **Status:** All marked "Not Started" — ready for implementation phase kickoff
