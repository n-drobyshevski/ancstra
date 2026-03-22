# Phase 3: Document Processing & OCR

> Weeks 19-25 | Started: TBD | Target: TBD

## Goals

- Enable users to upload and organize family documents (photos, certificates, letters, scans)
- Automatically extract text from historical documents using OCR (printed text via Tesseract, handwritten via Transkribus)
- Use Claude AI to extract structured genealogical data (names, dates, places, relationships) from OCR results
- Auto-link extracted persons to existing tree profiles with one-click confirmation
- Generate automatic source citations from document metadata

## Systems in Scope

- [Document Processing](../specs/document-processing.md)

## Task Breakdown

### Week 19-20: Document Upload & Media Management

**Goal:** Build file upload system and media storage with local-first support.

- [ ] Create media upload API:
  - [ ] `POST /api/media/upload` — accept multipart form with file, title, description, dates, tags
  - [ ] `GET /api/media` — list all media with pagination, filtering by type/date/linked-person
  - [ ] `GET /api/media/[id]` — retrieve media details and OCR text
  - [ ] `DELETE /api/media/[id]` — soft-delete media
- [ ] Set up file storage:
  - [ ] Local development: store in `public/uploads/` with organized subdirectories by date/type
  - [ ] Add file size limits (100MB single file, 1GB total for local dev)
  - [ ] File naming: use UUIDs to prevent collisions, preserve original name in metadata
  - [ ] Support formats: JPEG, PNG, PDF, GIF, TIFF (common in genealogy)
- [ ] Create media table in database:
  - [ ] `media` — id, file_name, file_path, mime_type, file_size, width, height (for images), title, description, upload_date, created_at, updated_at, soft_delete_at
  - [ ] Add relationships: `media_persons`, `media_events`, `media_sources` junction tables
- [ ] Build file upload UI component `apps/web/components/MediaUpload.tsx`:
  - [ ] Drag-and-drop zone for files
  - [ ] Click-to-browse file picker
  - [ ] Progress bar during upload
  - [ ] Batch upload support (multiple files)
  - [ ] Cancel button during upload
- [ ] Create media gallery UI `apps/web/components/MediaGallery.tsx`:
  - [ ] Grid view of thumbnails
  - [ ] Lightbox/modal for full-size viewing
  - [ ] Metadata display (date, linked persons, OCR status)
  - [ ] Quick-link button to person
  - [ ] Delete button
- [ ] Add metadata extraction:
  - [ ] Image EXIF data (date taken, camera info)
  - [ ] PDF metadata (title, author, creation date)
  - [ ] Store extracted metadata in database
- [ ] Create media detail page `apps/web/app/(auth)/media/[id]/page.tsx`:
  - [ ] Full-size image/document viewer with zoom, rotate, download
  - [ ] Metadata display section
  - [ ] Linked persons section (who appears in this media)
  - [ ] OCR text section (filled in Week 19-20)
  - [ ] Edit metadata button
- [ ] Implement media linking UI:
  - [ ] "Link to person" button → search and select person
  - [ ] "Link to event" button (for documents dated to specific events)
  - [ ] Show all links and allow unlinking

### Week 20-21: Image Preprocessing & Tesseract OCR

**Goal:** Preprocess documents and extract printed text.

- [ ] Set up OCR backend (Python FastAPI sidecar or Node.js):
  - [ ] If using Python: create `services/ocr/` directory with FastAPI app
  - [ ] If using Node: integrate `tesseract.js` directly into Next.js
  - [ ] For simplicity, recommend tesseract.js (no separate service needed)
- [ ] Integrate tesseract.js `apps/web/lib/ocr/tesseract.ts`:
  - [ ] Install `tesseract.js` and language data packs (eng, deu, fra, etc.)
  - [ ] Create worker for OCR processing
  - [ ] Implement preprocessing pipeline before OCR:
    - [ ] Image download to Buffer (if URL) or read from disk
    - [ ] Resize very large images to < 2000px (for performance)
    - [ ] Convert TIFF/PNG to JPEG if needed
    - [ ] Deskew: detect and correct rotation
    - [ ] Denoise: reduce background noise
    - [ ] Binarization: convert to black/white for clarity
    - [ ] Contrast enhancement: brighten faded documents
  - [ ] Use `sharp` library for image preprocessing
- [ ] Create OCR API route:
  - [ ] `POST /api/media/[id]/ocr` — trigger OCR for a media item
  - [ ] `GET /api/media/[id]/ocr/status` — check OCR progress
  - [ ] `GET /api/media/[id]/ocr/text` — retrieve OCR results
- [ ] Store OCR results:
  - [ ] `ocr_results` table — id, media_id, raw_text, confidence, language_detected, processing_time, created_at
  - [ ] Support multiple OCR attempts (different settings)
  - [ ] Store confidence scores
  - [ ] Track which language model was used
- [ ] Build OCR UI:
  - [ ] "Run OCR" button in media detail view
  - [ ] Progress indicator during processing
  - [ ] Display OCR text in sidebar with highlighting
  - [ ] Option to manually edit/correct OCR text
  - [ ] Language selector if auto-detection fails
- [ ] Support multiple languages:
  - [ ] English, German, French, Italian, Polish (common in genealogy)
  - [ ] Allow user to select language for OCR job
  - [ ] Auto-detect fallback if language not obvious
- [ ] Performance optimization:
  - [ ] Run OCR as background job (using job queue or cron)
  - [ ] Batch process multiple documents
  - [ ] Cache language models to reduce startup time

### Week 21-22: Transkribus Integration for Handwritten Documents

**Goal:** Support handwritten document recognition.

- [ ] Get Transkribus API credentials:
  - [ ] Register for free Transkribus account
  - [ ] Request API access (email support)
  - [ ] Add API credentials to `.env`
  - [ ] Understand credit system: 50-100 free credits/month (1 credit per handwritten page)
- [ ] Create Transkribus API client `apps/web/lib/ocr/transkribus.ts`:
  - [ ] `uploadDocument(mediaBuffer, language)` — upload file to Transkribus
  - [ ] `processDocument(docId)` — trigger recognition
  - [ ] `checkStatus(docId)` — poll for completion
  - [ ] `downloadText(docId)` — retrieve recognized text
  - [ ] Handle API rate limiting and quota
  - [ ] Error handling: free tier limits, unsupported file types
- [ ] Build intelligent OCR selector:
  - [ ] In OCR preprocessing step, examine image characteristics
  - [ ] If mostly handwritten: use Transkribus
  - [ ] If mostly printed: use Tesseract
  - [ ] If mixed: run both and combine results
  - [ ] Show user a confidence estimate before processing
- [ ] Create OCR selection UI:
  - [ ] When user clicks "Run OCR", show dialog with:
    - [ ] Preview of document
    - [ ] Detected script type (printed/handwritten/mixed)
    - [ ] Recommended OCR engine with explanation
    - [ ] Option to override and choose engine manually
    - [ ] Cost estimate (Transkribus credits if applicable)
  - [ ] Allow batch processing with same settings
- [ ] Implement credit tracking:
  - [ ] Store Transkribus account credit balance
  - [ ] Warn user before processing if low credits
  - [ ] Log credit usage per document
- [ ] Fallback for credits exhaustion:
  - [ ] If out of Transkribus credits, offer Tesseract as fallback (lower quality for handwriting, but free)
  - [ ] Allow manual transcription with editor UI
  - [ ] Pause OCR and notify user to wait for monthly credit refresh

### Week 22-23: Claude AI Entity Extraction

**Goal:** Extract structured genealogical data from OCR text.

- [ ] Create entity extraction prompt in `apps/web/lib/ai/extraction-prompts.ts`:
  - [ ] System message: "You are a genealogy data expert. Extract structured data from OCR'd historical documents."
  - [ ] Extraction targets:
    - [ ] Names (given names, surnames, maiden names, nicknames)
    - [ ] Dates (birth, death, marriage, events)
    - [ ] Places (birth place, death place, residence, migration points)
    - [ ] Relationships (parents, spouse, children, siblings mentioned)
    - [ ] Occupations, events, descriptions
    - [ ] Institutions/organizations (churches, cemeteries, courts)
  - [ ] Output format: structured JSON with confidence scores
  - [ ] Handle incomplete/ambiguous data gracefully
- [ ] Create extraction API route:
  - [ ] `POST /api/media/[id]/extract` — trigger AI extraction on OCR'd text
  - [ ] `GET /api/media/[id]/extraction` — retrieve extracted entities
- [ ] Store extraction results:
  - [ ] `extracted_entities` table — id, media_id, entity_type, raw_text, extracted_value, confidence, created_at
  - [ ] Support: person_name, date, place, relationship, occupation, organization
  - [ ] Track confidence scores for each extraction
- [ ] Build extraction UI `apps/web/components/EntityExtraction.tsx`:
  - [ ] Display extracted entities with confidence indicators
  - [ ] Highlight entities in original OCR text (clickable)
  - [ ] Allow user to edit/confirm each extraction
  - [ ] Add entities button to create new persons or events
  - [ ] Store user feedback to improve future extractions

### Week 23-24: Auto-Linking & Source Creation

**Goal:** Automatically suggest linking extracted persons and create sources.

- [ ] Build entity-to-person matching:
  - [ ] For each extracted person name:
    - [ ] Search local tree using FTS (similar to Phase 2 hints)
    - [ ] Score matches using Jaro-Winkler + date/place context
    - [ ] Return top matches with confidence
  - [ ] Create `matches` table — id, extracted_entity_id, person_id, score, status (suggested, linked, dismissed)
- [ ] Create auto-linking UI:
  - [ ] For each extracted person:
    - [ ] Show top match suggestions (if any)
    - [ ] Link button to confirm and link
    - [ ] "Create new person" button if not in tree
    - [ ] Skip button if uncertain
  - [ ] Batch interface to process all entities in a document
  - [ ] Show summary of linked persons after completion
- [ ] Implement person creation from extraction:
  - [ ] When user clicks "Create new", open form pre-populated with extracted data
  - [ ] Allow editing before saving
  - [ ] Add to tree with source linked
- [ ] Build automatic source citation:
  - [ ] From document metadata + extraction:
    - [ ] Title: "Family document: [extracted date/type]" or user-provided title
    - [ ] Repository: user's collection (locator: "/media/[id]")
    - [ ] Citation: "Transcription of [document title], [date], [user's family name] collection"
    - [ ] URL: link to media detail page in app
  - [ ] Allow editing before saving
  - [ ] Link source to all extracted events
- [ ] Create source linking workflow:
  - [ ] After entities are reviewed/linked, offer one-click source creation
  - [ ] Source pre-populated with document metadata
  - [ ] Link to persons and events in one operation
  - [ ] Save operation creates/updates source and associations

### Week 24-25: Document Review UI & Integration

**Goal:** Create comprehensive document review interface and integrate into tree workflow.

- [ ] Build document review page `apps/web/app/(auth)/documents/[id]/review/page.tsx`:
  - [ ] Three-column layout:
    - [ ] Left: document image with zoom/rotate controls
    - [ ] Center: OCR text (editable)
    - [ ] Right: extracted entities with confirmation UI
  - [ ] Workflow indicators showing completed steps
  - [ ] Save button to commit all changes
  - [ ] Next/Previous buttons to move through document queue
- [ ] Create document library interface `apps/web/app/(auth)/documents/page.tsx`:
  - [ ] Filter by:
    - [ ] Document type (photo, certificate, letter, etc.)
    - [ ] OCR status (not processed, processing, completed, manual)
    - [ ] Linked person
    - [ ] Date range
  - [ ] Batch operations:
    - [ ] Select multiple documents
    - [ ] Run OCR on all
    - [ ] Mark as reviewed
  - [ ] Sort by date, upload date, OCR status
  - [ ] Search by title/description
- [ ] Integrate documents into person detail view:
  - [ ] New "Documents" tab in person detail
  - [ ] List of all documents linked to this person
  - [ ] Quick upload button from person view
  - [ ] Drag-drop to add document to person
- [ ] Add document timeline:
  - [ ] Timeline view showing documents by date
  - [ ] Synchronized with person events
  - [ ] Show alongside birth, death, census records, etc.
  - [ ] Visual grouping by year/decade
- [ ] Build search across documents:
  - [ ] Full-text search on OCR'd text and extracted entities
  - [ ] Search: "birth certificates for John Smith"
  - [ ] Result: all documents with John Smith + birth extraction
- [ ] Implement document workflow status:
  - [ ] Status states: Uploaded → OCR Processing → Entity Review → Linked → Archived
  - [ ] Display status badge in document list
  - [ ] Filter by status
- [ ] Add user guidance:
  - [ ] Tooltips for each extraction type
  - [ ] Example corrections for common OCR errors
  - [ ] Help text on entity matching UI
  - [ ] Tutorial/walkthrough for first document upload

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | File upload + media storage (local), Media gallery UI, Tesseract.js OCR (printed text), Claude AI entity extraction (names, dates, places), Auto-linking UI (match extracted persons to tree), Source citation generation |
| **Should** | Transkribus integration (handwritten), Image preprocessing pipeline (deskew, denoise), Document review three-column UI, Batch OCR processing |
| **Could** | Intelligent OCR selector (printed vs handwritten auto-detect), Document timeline view, Full-text search across OCR'd text |
| **Won't (this phase)** | Cloudflare R2 storage (web deploy uses Turso, media in Phase 5c), Video file support |

## Documentation (write during this phase)

- [ ] Document upload user guide (supported formats, file size limits)
- [ ] OCR limitations documentation (accuracy expectations per document type)
- [ ] Transkribus credit tracking and management guide

## Exit Gate: Phase 3 to Phase 4 (Auth & Collaboration)

Before starting Phase 4, verify:
- [ ] OCR pipeline processes 10+ real documents with >70% text accuracy
- [ ] Entity extraction identifies names and dates in 80%+ of test documents
- [ ] Auto-linking suggests correct tree person in 70%+ of cases
- [ ] Source citation auto-generation produces valid citations
- [ ] All Phase 1-2 performance baselines still pass

## Feedback Loop

After Phase 3 is complete:
- [ ] Test document upload pipeline with real family documents (birth certificates, census records, letters)
- [ ] Does the OCR-to-extraction pipeline feel useful or frustrating?
- [ ] Document accuracy rates and common failure patterns
- [ ] Adjust entity extraction prompts based on real-world results

---

## Key Risks

1. **OCR accuracy on degraded documents** — Very old, stained, or faded documents may have low OCR quality. Handwritten documents are especially challenging. Mitigate: implement preprocessing pipeline thoroughly (deskew, denoise, contrast enhancement), set user expectations (show confidence scores), allow manual correction, test with variety of document types.

2. **Transkribus credit exhaustion** — User may run out of free credits and OCR halts. Mitigate: show credit balance and warnings before processing, implement Tesseract fallback, batch similar documents efficiently, educate user on cost.

3. **Entity extraction ambiguity** — Claude may incorrectly extract names or dates from OCR text. Example: "John Smith, son of Mary" — is Mary the mother? Wife? Mitigate: show confidence scores, require user confirmation, provide clear examples in extraction UI.

4. **False auto-linking of persons** — Matching algorithm may link extracted person to wrong tree person (e.g., common name). Mitigate: set high confidence threshold for auto-suggest only, require user review before final link, track false matches to improve algorithm.

5. **Scalability of OCR processing** — Running OCR on 1000+ documents is time-consuming. Mitigate: implement background job queue (Bull, RQ, or Inngest), batch process nightly, add progress UI, set rate limits to avoid API quota issues.

## Decisions Made During This Phase

(Empty — filled during implementation)

## Retrospective

(Empty — filled at phase end)
