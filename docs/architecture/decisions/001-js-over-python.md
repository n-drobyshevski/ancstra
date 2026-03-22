# ADR-001: JavaScript/TypeScript Over Python Sidecar

> Date: 2026-03-21 | Status: Accepted

## Context

The research proposal suggested using FastAPI as a Python sidecar service for compute-intensive tasks: OCR (Tesseract), NLP, DNA analysis (scikit-allel), face recognition (DeepFace), image restoration (GFPGAN/Real-ESRGAN), and record matching (Splink). This would mean deploying two separate runtimes — Node.js for the web app and Python for background services.

At the same time, modern JavaScript/TypeScript ecosystems have evolved to provide equivalent or near-equivalent functionality:
- **tesseract.js:** Exact same Tesseract engine compiled to WebAssembly
- **face-api.js:** TensorFlow.js-based face detection and recognition
- **sharp:** Node.js image processing library (resizing, rotation, normalization)
- **Replicate:** Cloud API for advanced image processing (GFPGAN, Real-ESRGAN)
- **Custom TypeScript:** Record matching using Jaro-Winkler distance and Levenshtein

## Decision

**Use JavaScript/TypeScript for everything possible in Phases 1–3. Defer Python entirely unless proven inadequate.**

- Single runtime (Node.js only) for phases 1–3
- Python only via:
  1. Cloud APIs (Replicate for image upscaling/restoration)
  2. Subprocess calls for unavoidable C/C++ binaries (e.g., PLINK for DNA)
  3. Future sidecar service if record matching (Splink) quality is required

Concretely:
- OCR: tesseract.js for printed text, Transkribus REST API for handwriting
- Face detection: face-api.js for detection + basic recognition
- Image restoration: Replicate cloud API (~$0.01 per image)
- Record matching: Custom TypeScript implementation (Jaro-Winkler + fastest-levenshtein)
- DNA analysis: Basic cM estimation in TypeScript; PLINK via subprocess if needed

## Reasons

1. **Single runtime simplifies deployment:** No Docker orchestration, no supervisor process, no port conflicts. The app is one npm workspace on a single Node.js process.
2. **Reduces debugging surface:** Errors are in JavaScript stack traces, not split across two languages. Development workflow is unified.
3. **Lower operational overhead:** No Java (Neo4j via Python), no Python environment management, no version conflicts between Conda and Node.
4. **Offline capability:** WebAssembly-based tools (tesseract.js) run fully offline. REST APIs degrade gracefully if network is unavailable.
5. **Cost-effective:** Free tier of Replicate API covers most users; Python sidecar would require always-on compute ($5–20/month).
6. **Ecosystem maturity:** TensorFlow.js, Sharp, and npm record-linking libraries are production-ready.
7. **Single-developer sustainability:** Fewer moving parts = fewer failure modes for solo development.

## Consequences

1. **Record matching quality trade-off:** Custom Jaro-Winkler + Levenshtein will likely have lower F1 score (~75–80%) than Splink initially. Mitigation: benchmark against test dataset after Phase 2 MVP; upgrade path documented in Section 8.
2. **Image upscaling costs:** Replicate APIs at ~$0.01 per image. For users with thousands of photos, monthly cost could reach $10–20. Mitigation: make upscaling opt-in; provide local fallback (ImageMagick).
3. **Face recognition accuracy:** face-api.js is good for detection but weaker at person identification than DeepFace. Acceptable for MVP (provides suggestions; editor confirms).
4. **DNA analysis limitations:** Without PLINK, IBD detection and haplogroup assignment are deferred. Basic cM estimation from raw segments is sufficient for Phase 4 MVP.

## Decision Matrix (Full Evaluation)

| Tool | Purpose | Python-Only? | JS Alternative | Quality Comparison | Decision | Phase |
|------|---------|-------------|----------------|-------------------|----------|-------|
| **Splink** | Record linkage (probabilistic matching) | Yes | Custom TS matcher (jaro-winkler + fastest-levenshtein npm) | Splink: 90%+ F1; Custom TS: ~75–80% initially. Upgrade path documented (Section 8). | **TS for MVP**, upgrade to Splink sidecar if needed | 1 |
| **Tesseract** | Printed-text OCR | No | tesseract.js (same engine, WASM binary) | Identical quality — same underlying engine | **JS** — zero functional difference | 3 |
| **OpenCV** | Image preprocessing (resize, rotate, denoise, normalize) | Partial | sharp (Node.js library) | sharp sufficient for all common operations; OpenCV is overkill for genealogy images | **sharp** for MVP | 3 |
| **DeepFace** | Face detection, recognition, attribute analysis | Yes | face-api.js (TensorFlow.js models) | face-api.js: 98%+ detection accuracy, ~85% ID accuracy; DeepFace: ~99%+ detection, ~95% ID | **face-api.js** — acceptable for MVP suggestions | 4 |
| **GFPGAN** | Face restoration (old photo enhancement) | Yes | Replicate API (runs GFPGAN in cloud) | Identical output (same model); pay per use instead of GPU cost | **Replicate API** (~$0.01/image) | 4 |
| **Real-ESRGAN** | Image upscaling 2x/4x | Yes | Replicate API or local NCNN binary | Replicate: cost-effective; local: requires C++ compilation | **Replicate API** for MVP | 4 |
| **CodeFormer** | Face restoration (better than GFPGAN for real images) | Yes | Replicate API | Identical (cloud inference) | **Replicate API** | 4 |
| **DDColor** | Historical photo colorization (optional) | Yes | Replicate API | Identical quality; optional feature | **Replicate API** (defer if budget tight) | 4+ |
| **Transkribus** | Handwritten text OCR | N/A | REST API (language-agnostic, no Python required) | Identical — Transkribus *is* the service | **HTTP calls from TS** (50–100 free credits/month) | 3 |
| **PLINK** | DNA IBD detection, haplotype inference | C++ binary | Subprocess call if needed; basic cM math in TS | PLINK: high-precision haplotyping; TS cM: sufficient for MVP | **Defer PLINK**, use TS cM estimation for Phase 4 | 4+ |
| **scikit-allel** | Population genetics, allele frequency analysis | Yes | None (specialized domain) | No practical JS alternative | **Defer entirely** (Phase 5+, if ever needed) | 5+ |
| **Gramps Web API** | Genealogy data layer, validation rules | Yes | Native TypeScript data model (Drizzle ORM) | Gramps: battle-tested 20 years; TS: custom but owns schema | **Reject as runtime dep** (ADR-003); study schema as reference | 1 |

## Revisit Triggers

1. **Record matching quality < 70% F1:** If Phase 2 A/B testing shows custom TS matcher is too error-prone (>20% false positives), evaluate Splink FastAPI sidecar.
2. **Face recognition requested in user feedback:** If users ask for automated person identification in photos, integrate DeepFace sidecar.
3. **Significant cost overruns from Replicate API:** If Phase 4 image processing costs exceed $100/month, evaluate local image upscaling (requires C++ compilation).
4. **DNA analysis becomes MVP requirement:** If users heavily rely on IBD detection, set up PLINK subprocess.

---

## Related Decisions

- **ADR-002:** SQLite over Neo4j (consequence: no Java runtime needed)
- **ADR-003:** Gramps as reference only (consequence: custom TS data layer required)
- **ADR-004:** Local-first architecture (consequence: PWA-compatible JS stack)
