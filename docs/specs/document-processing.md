# Document Processing & OCR

> Phase: 3 | Status: Not Started
> Depth: design-level
> Dependencies: [record-matching.md](record-matching.md), [ai-research-assistant.md](ai-research-assistant.md)
> Data model: documents, extracted_entities tables

## Overview

End-to-end document processing pipeline: preprocessing with Sharp, printed text OCR via tesseract.js (WASM), handwriting via Transkribus REST API, and AI-powered entity extraction using Claude. No Python dependencies — all JS/TS except Transkribus cloud service.

## Requirements

- [ ] Image upload with drag-drop and camera capture
- [ ] Image preprocessing (Sharp): rotation, grayscale, contrast normalization, sharpening
- [ ] OCR engine selection: tesseract.js for printed, Transkribus for handwriting
- [ ] Progress tracking for long-running OCR (especially Transkribus polling)
- [ ] Claude-powered entity extraction: persons, events, relationships
- [ ] Review UI for confirming/correcting extracted entities
- [ ] Auto-linking to tree persons via record matching engine
- [ ] Document metadata storage (source type, date range, collection)
- [ ] Transcript versioning (corrections tracked)

## Design

### Architecture Pipeline

```
Upload (drag-drop / camera)
  │
  ├─→ File validation (format, size)
  │
  v
Preprocessing (Sharp: rotate, grayscale, normalize, sharpen)
  │
  v
OCR Engine Selection
  ├─→ Printed text → tesseract.js (WASM)
  │   (output: OcrResult with text + confidence)
  │
  └─→ Handwriting → Transkribus REST API
      (output: same OcrResult after polling)
  │
  v
Claude API (entity extraction)
  │ Names, dates, places, relationships with confidence scores
  │
  v
Review UI
  │ Confirm/correct extracted entities
  │
  v
Auto-linking via Record Matching Engine
  │ Match extracted persons to tree
  │
  v
Store in documents + extracted_entities tables
```

### Image Preprocessing with Sharp

Preprocessing improves OCR accuracy for scanned documents:

```typescript
async function preprocessForOcr(inputBuffer: Buffer): Promise<Buffer>
```

**Steps:**

1. **Auto-rotate:** Extract EXIF orientation data
2. **Grayscale:** Single-channel improves Tesseract accuracy
3. **Normalize:** Fix faded/low-contrast scans (stretch histogram)
4. **Sharpen:** Compensate for blur, help with small text
5. Output: processed buffer ready for OCR

### OCR with tesseract.js (Printed Text)

WASM-based Tesseract engine (same quality as Python Tesseract, no Python required):

```typescript
interface OcrResult {
  text: string
  confidence: number    // 0-100
  engine: 'tesseract' | 'transkribus'
  duration: number      // ms
}

async function ocrWithTesseract(
  imageBuffer: Buffer,
  language = 'eng',
  onProgress?: (pct: number) => void
): Promise<OcrResult>
```

**Workflow:**

1. Create worker with language (supports 100+ languages)
2. Register progress callback for UI updates
3. Recognize text from image buffer
4. Terminate worker (free memory)
5. Return text + confidence + duration

**Supports multiple languages:** English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, etc.

### Transkribus for Handwriting

REST API for handwriting OCR (language-agnostic, 50-100 free credits/month):

```typescript
async function ocrWithTranskribus(
  imageBuffer: Buffer
): Promise<OcrResult>
```

**Workflow:**

1. Upload image to Transkribus service
2. Start recognition job (returns jobId)
3. Poll for completion with exponential backoff
4. Extract recognized text from result
5. Return OcrResult

**Cost:** ~1 credit per image (monthly free tier included)

### AI Entity Extraction

After OCR, Claude extracts structured genealogical data from raw text:

```typescript
interface ExtractedEntities {
  persons: {
    name: string
    role?: string        // 'parent', 'spouse', 'witness', etc.
    age?: string
    confidence: number   // 0-1
  }[]
  events: {
    type: string        // 'birth', 'marriage', 'death', 'census', etc.
    date?: string
    place?: string
    confidence: number
  }[]
  relationships: {
    person1: string
    person2: string
    type: string        // 'parent-child', 'spouse', 'sibling', etc.
    confidence: number
  }[]
}
```

**Extraction prompt:**

```
Extract structured genealogical data from this OCR text.
Return JSON with:
- persons: name (required), role (optional), age (optional), confidence
- events: type, date, place, confidence
- relationships: person1, person2, type, confidence

Be conservative — only extract what you're confident about.
Document type: {documentType}
OCR text: {ocrText}
```

**Document types:** census, vital_record, ship_manifest, will, church_record, newspaper, military_record, land_record

### Review & Linking

1. **User review UI:** Display extracted entities with confidence scores
2. **Edit fields:** User can correct/add missing data
3. **Record matching:** Apply record-matching engine to link extracted persons to tree
   - High confidence (>= 0.95): suggest as confirmed match
   - Medium confidence (0.70-0.95): suggest for review
   - Low confidence (< 0.70): show as potential match
4. **Store:** Save document + entities + links to tree

## Edge Cases & Error Handling

- **Very blurry/damaged images:** Preprocessing may not recover. Fallback to manual transcription.
- **Mixed printed/handwriting:** Manual document-type selection, process with appropriate engine
- **OCR high confidence, low accuracy:** Warn user for historical documents with archaic spelling
- **Entity extraction hallucination:** Show confidence scores, encourage review
- **Large documents (many pages):** Process per-page, aggregate results
- **Non-English text:** Tesseract supports 100+ languages; Transkribus language auto-detection

## Open Questions

- Batch processing multiple pages from single document?
- Integration with document dating (auto-estimate from content)?
- Transcript versioning — track corrections over time?
- Sharing OCR results with family members for crowdsourced verification?
- Transkribus handwriting fine-tuning for historical script styles?

## Implementation Notes

Location: `packages/ocr/`

Key files:
- `preprocessing/prepare-image.ts` - Sharp preprocessing
- `tesseract/ocr-engine.ts` - tesseract.js wrapper with progress
- `transkribus/handwriting-ocr.ts` - Transkribus REST client with polling
- `extraction/entity-extractor.ts` - Claude entity extraction
- `linking/auto-link.ts` - Record matching integration

**Dependencies:**

- `sharp` - Image preprocessing
- `tesseract.js` - Printed text OCR
- `@anthropic-ai/sdk` - Claude entity extraction
- Standard `fetch` API - Transkribus HTTP calls
