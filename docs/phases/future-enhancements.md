# Future Enhancements: Photos & DNA

> Post-launch feature packs | Implement after Phase 6.5 (beta)
> Originally Phase 4 in the pre-launch roadmap -- moved to post-launch to focus on core genealogy features first.

## Rationale

Photos & DNA are powerful but non-essential features. The core genealogy app (tree building, GEDCOM, AI research, document processing, collaboration) delivers full value without them. By deferring, we:

- Ship 9 weeks sooner (~44.5 vs ~53.5 weeks)
- Reduce cognitive load during the critical implementation phases
- Can validate demand through user feedback before investing
- Can implement modules independently based on user interest

## Structure

Photos and DNA are broken into **8 independent modules**. Each can be implemented, tested, and shipped separately. No module depends on another unless explicitly stated.

---

## Feature Pack A: Photo Intelligence

### Module 1: Face Detection & Tagging (2-3 weeks)

**What:** Detect faces in uploaded photos and let users manually tag who's who.

**Prerequisites:** Phase 3 media upload system must exist.

**Scope:**
- [ ] Integrate `@vladmandic/face-api` (maintained face-api.js fork)
- [ ] Create face detection API route: `POST /api/media/[id]/detect-faces`
- [ ] Store face data:
  - `detected_faces` table -- id, media_id, x, y, width, height, confidence, embedding (JSON)
  - `face_person_links` table -- face_id, person_id, confidence
- [ ] Face detection pipeline:
  - Load pre-trained model (RetinaFace or MTCNN for old photos)
  - Detect all faces, extract bounding boxes
  - Extract face embeddings (ArcFace) for future clustering
  - Store results with confidence scores
- [ ] Face tagging UI:
  - Display detected faces with bounding boxes on photo
  - Click a face -> search tree for person -> assign
  - Show confidence percentage
  - Option to dismiss false detections
- [ ] Privacy: don't show faces of living persons in shared/exported views
- [ ] Background processing: don't block UI during detection

**Value:** Users can browse "all photos of Grandma" across their collection.

---

### Module 2: Face Clustering & Auto-Matching (2 weeks)

**What:** Automatically group faces by individual and suggest tree person matches.

**Prerequisites:** Module 1 (face detection must exist).

**Scope:**
- [ ] Clustering algorithm:
  - Compare face embeddings using cosine similarity
  - Cluster faces with similarity > 0.6-0.7 threshold
  - Each cluster = one individual
- [ ] Cluster management API:
  - `POST /api/faces/cluster` -- run clustering
  - `GET /api/faces/clusters` -- list all clusters
  - `PUT /api/faces/clusters/[id]/label` -- assign person to cluster
  - `PUT /api/faces/clusters/[id]/merge` -- merge two clusters
  - `PUT /api/faces/clusters/[id]/split` -- split a cluster
- [ ] Cluster UI:
  - Gallery view of all clusters with representative faces
  - Assign person to cluster via tree search
  - Merge/split clusters manually
  - Remove false detections
- [ ] Auto-matching suggestions:
  - Suggest persons based on age estimation vs. birth date
  - Suggest based on photos already linked to that person
  - Show suggestions with confidence score

**Value:** "We found 47 photos of this person" -- automatic photo organization.

---

### Module 3: Photo Restoration & Enhancement (2 weeks)

**What:** Restore and upscale degraded old family photos using AI.

**Prerequisites:** Phase 3 media system (does NOT require Module 1/2).

**Scope:**
- [ ] Enhancement pipeline `apps/web/lib/image/enhancement.ts`:
  - Face restoration: GFPGAN (handles blur, noise, damage)
  - General upscaling: Real-ESRGAN (2x-4x resolution increase)
  - Apply face restoration to detected face regions specifically
- [ ] Enhancement API routes:
  - `POST /api/media/[id]/enhance` -- full pipeline
  - `POST /api/media/[id]/restore-face` -- faces only
  - `POST /api/media/[id]/upscale` -- upscale only
  - `GET /api/media/[id]/enhancement/status` -- progress check
- [ ] Version tracking:
  - `media_versions` table -- id, media_id, version_type (original, restored, upscaled), file_path
  - Keep original + enhanced versions separately
  - Toggle between versions in UI
- [ ] Enhancement UI:
  - Before/after slider view
  - Settings: upscale factor (2x/3x/4x), face restoration on/off
  - Progress indicator (can take seconds to minutes)
  - Save enhanced version button

**Value:** Turn blurry 1920s photo into a clear, detailed image.

---

### Module 4: Photo Colorization (1 week)

**What:** Colorize black-and-white photos using AI. Experimental/interpretive.

**Prerequisites:** Module 3 (enhancement pipeline).

**Scope:**
- [ ] Integrate DDColor or similar colorization model
- [ ] Add `POST /api/media/[id]/colorize` endpoint
- [ ] Store colorized version as a `media_version`
- [ ] UI: colorization toggle, before/after view
- [ ] Clear disclaimer: "Colorization is interpretive, not historically accurate"
- [ ] Mark colorized photos clearly in gallery

**Value:** Engaging visual feature that brings old photos to life. Low effort, high wow factor.

**Note:** This is the lowest priority photo module. Skip if time-constrained.

---

## Feature Pack B: DNA Analysis

### Module 5: DNA File Parsing & Secure Storage (2-3 weeks)

**What:** Parse raw DNA files from all major providers and store encrypted.

**Prerequisites:** None beyond Phase 1 core database.

**Scope:**
- [ ] DNA file parsers `apps/web/lib/dna/parsers.ts`:
  - 23andMe: text format (rsid, chromosome, position, genotype)
  - AncestryDNA: ZIP with multiple files
  - MyHeritage: text format (similar to 23andMe)
  - FamilyTreeDNA: FTDNA text format
  - Generic VCF: Variant Call Format
  - Format auto-detection from file header
- [ ] Storage schema:
  - `dna_kits` table -- id, person_id, kit_name, provider, file_hash, uploaded_at
  - `dna_snps` table -- id, kit_id, rsid, chromosome, position, genotype
  - Encrypt SNP data at rest (app-level column encryption or SQLCipher)
  - Privacy flag: `dna_kits.is_private`
- [ ] Consent tracking:
  - Explicit consent checkbox before upload
  - Per-kit consent record in database
  - Deletion audit trail
- [ ] Upload UI `apps/web/app/(auth)/dna/upload/page.tsx`:
  - File picker + drag-and-drop
  - Format auto-detection display
  - Consent checkbox
  - Assign to person or anonymous kit
  - Preview: first few SNPs, genotype counts
- [ ] DNA API routes:
  - `POST /api/dna/upload` -- parse and store
  - `GET /api/dna/kits` -- list kits
  - `GET /api/dna/kits/[id]` -- kit details
  - `DELETE /api/dna/kits/[id]` -- remove kit (with audit trail)

**Legal note:** DNA is "special category" data under GDPR Article 9. Requires explicit consent and additional safeguards.

**Value:** Foundation for all DNA features. Users can safely store their DNA data alongside their tree.

---

### Module 6: Shared Segment Detection & Relationship Estimation (2 weeks)

**What:** Find shared DNA segments between kits and estimate biological relationships.

**Prerequisites:** Module 5 (DNA parsing/storage).

**Scope:**
- [ ] IBD (Identical By Descent) detection algorithm:
  - Compare two kits' genotypes at each position
  - Find runs of consecutive matching SNPs
  - Minimum segment: 500K base pairs (avoid false positives)
  - Return shared segments with chromosome, start/end, cM estimate
- [ ] centiMorgan (cM) estimation:
  - Basic: cM = (segment_length_bp / 1,000,000) * 100
  - Advanced (optional): use linkage map for better accuracy
  - Sum cM across all segments = total shared DNA
- [ ] Relationship estimation lookup table:
  - >2000 cM = Self
  - 1700-2000 cM = Parent-child, full sibling
  - 850-1700 cM = Grandparent, aunt/uncle, half-sibling
  - 400-850 cM = First cousin, great-aunt/uncle
  - 200-400 cM = 1C1R, first cousin + sibling
  - 100-200 cM = 1C2R, second cousin
  - 50-100 cM = 2C1R, third cousin
  - <50 cM = Very distant (4th cousin+)
- [ ] Storage:
  - `dna_matches` table -- id, kit1_id, kit2_id, shared_cM, estimated_relationship, confidence
  - `dna_segments` table -- id, match_id, chromosome, start_pos, end_pos, cM_estimate
- [ ] Matching API:
  - `POST /api/dna/match` -- compare two kits
  - `GET /api/dna/matches/[kit_id]` -- find all matches for a kit
- [ ] Performance: cache results, batch process in background

**Value:** "Your DNA shows you share 850 cM with this person -- likely a grandparent or aunt/uncle."

---

### Module 7: DNA-Tree Integration & Validation (2 weeks)

**What:** Link DNA matches to tree persons and validate relationships against genetic evidence.

**Prerequisites:** Module 6 (segment detection).

**Scope:**
- [ ] DNA match-to-person linking:
  - Search tree for person matching the DNA match
  - Suggest persons based on relationship estimate + tree structure
  - "This match is ~1200 cM (first cousin). Your tree shows John and Jane as first cousins."
- [ ] Relationship validation:
  - For linked matches: compare DNA relationship vs tree relationship
  - Flag discrepancies: "DNA says first cousin, tree says sibling"
  - Store validation: matches, conflicts, unresolved
- [ ] DNA-tree dashboard `apps/web/app/(auth)/dna/page.tsx`:
  - Summary: kits uploaded, matches found
  - Match list: shared cM, estimated relationship, linked person, match/conflict indicator
  - Unmatched DNA matches list
- [ ] Conflict resolution workflow:
  - "DNA is correct -- update tree"
  - "Tree is correct -- different person"
  - "Uncertain -- mark for research"
  - Track decisions and reasoning
- [ ] DNA validation report:
  - % of relationships validated by DNA
  - High-confidence vs uncertain relationships
  - Export as PDF

**Value:** "DNA confirms your tree is correct" or "DNA suggests this relationship needs investigation."

---

### Module 8: Chromosome Browser (1-2 weeks)

**What:** Visual display of shared DNA segments across all 23 chromosomes.

**Prerequisites:** Module 6 (segment detection).

**Scope:**
- [ ] Chromosome browser component `apps/web/components/ChromosomeBrowser.tsx`:
  - 23 horizontal bars representing chromosomes
  - Colored blocks showing shared segments
  - Tooltip on hover: chromosome, position range, cM length
  - Color-code by match (different match = different color)
- [ ] Integration: accessible from DNA match detail view
- [ ] Segment export:
  - CSV format compatible with DNA Painter
  - Format: chromosome, start, end, cM, match_name
- [ ] Inspired by DNA Painter's UI patterns

**Value:** Visual "painting" of which DNA segments come from which ancestor.

---

## Implementation Priority (Suggested Order)

When post-launch feedback indicates demand, implement in this order:

| Priority | Module | Duration | Rationale |
|----------|--------|----------|-----------|
| 1st | Module 1: Face Detection | 2-3 weeks | Most requested photo feature; foundation for modules 2-4 |
| 2nd | Module 5: DNA Parsing | 2-3 weeks | Foundation for all DNA; independent of photos |
| 3rd | Module 2: Face Clustering | 2 weeks | High value once detection exists |
| 4th | Module 6: Segment Detection | 2 weeks | Core DNA value once parsing exists |
| 5th | Module 3: Photo Restoration | 2 weeks | High wow-factor, independent of face features |
| 6th | Module 7: DNA-Tree Integration | 2 weeks | Connects DNA to core app value |
| 7th | Module 8: Chromosome Browser | 1-2 weeks | Visual polish for DNA features |
| 8th | Module 4: Photo Colorization | 1 week | Nice-to-have, experimental |

**Total if all implemented:** ~16-19 weeks (but shipped incrementally, each module adds independent value)

## Technical Spikes (Run Before Implementation)

Before starting any module, validate these assumptions (originally in Phase 0.5):

- **For Modules 1-4:** Test face-api.js on degraded old photos (pre-1950). Does detection work at >60% accuracy?
- **For Module 5:** Test SQLCipher + Drizzle compatibility (or design app-level encryption alternative)
- **For Module 3:** Test GFPGAN/Real-ESRGAN in Node.js environment. May need Python sidecar or cloud API (Replicate).

## Key Risks

1. **Face detection on old photos** -- Very degraded, low-res photos may not work. Use MTCNN for robustness; set low threshold but require user confirmation.
2. **Face clustering false positives** -- Similar-looking relatives may be grouped together. High threshold (0.8+) for auto-merge; always require confirmation.
3. **DNA segment false positives** -- Very short segments may not be true IBD. Minimum 500K bp; educate users on statistical confidence.
4. **DNA privacy breach** -- Genetic data is extremely sensitive. Encrypt at rest, never transmit unencrypted, consent tracking, deletion audit trail.
5. **GFPGAN/Real-ESRGAN in JS** -- May need Python sidecar, which conflicts with ADR-001 (JS-only). Consider Replicate API or WASM alternatives.
