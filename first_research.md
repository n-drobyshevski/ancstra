# Building an AI-powered personal genealogy app

**A solo developer with Claude as co-developer can build a privacy-first, AI-powered genealogy tool that outperforms commercial platforms in key ways — for $0/month in hosting costs.** The genealogy software market ($4.57B in 2024) is fragmented between expensive walled gardens like Ancestry ($319–$720/year) and free but limited tools like FamilySearch and Gramps. The critical insight: FamilySearch offers a **free, comprehensive REST API** with access to 66 billion records, and open-source tools like Gramps provide battle-tested genealogy logic. By combining these with Claude's AI capabilities for document analysis, record matching, and research assistance, a personal tool can serve as a unified "command center" that no commercial platform offers — one that searches across all sources, keeps data locally owned, and uses AI to break through research walls.

---

## The competitive landscape reveals massive gaps

The six major platforms each have fundamental limitations that create opportunity. **Ancestry.com** has 60 billion records and the largest DNA database, but charges $319–$720/year, offers no public API, and locks attached records behind subscriptions. **MyHeritage** leads in AI photo tools (Deep Nostalgia, colorization, AI Biographer) but suffered a 92-million-account data breach in 2018. **FamilySearch** is completely free with the best API in the industry, but its collaborative tree suffers from vandalism and quality issues. **Gramps** provides full data ownership as open-source desktop software but has no cloud, AI, or record-search features.

No existing platform offers an AI research assistant that intelligently queries multiple data sources, cross-references results, and suggests next steps. No tool provides intelligent source verification or conflict resolution across merged trees. Cross-platform data unification is broken — users maintain separate trees on 3–5 platforms, with GEDCOM (a 1996-era format) as the only interchange standard. Photo and document organization remains primitive. The opportunity is a **local-first, AI-powered tool that acts as a master database** syncing with FamilySearch's free API, importing from all sources, and applying AI to every step of the research workflow.

---

## Recommended tech stack optimized for a solo developer

The stack below prioritizes zero infrastructure cost, maximum developer productivity, and the ability to share with family when ready.

### Core architecture

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 15 (App Router) + TypeScript | Largest ecosystem, Vercel AI SDK integration, server components for full-stack in one codebase |
| **UI** | shadcn/ui + TailwindCSS | Copy-paste components, no library lock-in, excellent accessibility |
| **Tree visualization** | family-chart (primary) + Topola (GEDCOM viewer) | family-chart: 680 stars, MIT, purpose-built for genealogy with React/Svelte/Vue support. Topola: native GEDCOM parsing, 5 chart types (ancestors, descendants, hourglass, relatives, fancy), PDF/PNG/SVG export |
| **Database** | SQLite via better-sqlite3 or Drizzle ORM | Zero infrastructure, proven in genealogy (RootsMagic uses it), recursive CTEs handle all ancestor/descendant queries, entire database is one portable file |
| **AI integration** | Vercel AI SDK + Claude API | Streaming responses, tool calling, document analysis |
| **Python sidecar** | FastAPI (for OCR, NLP, DNA analysis) | Python has unmatched AI/ML libraries; optional — only needed for Phase 3+ |
| **GEDCOM parsing** | Topola's built-in parser (JS) + gedcom7 (Python) | Cover both 5.5.1 and 7.0; Topola handles visualization + parsing in one library |
| **File storage** | Local filesystem → Cloudflare R2 when web-hosted | R2: 10GB free, zero egress fees |
| **Hosting** | Local dev → Vercel free tier + Turso (edge SQLite) | $0/month achievable; Turso offers 9GB free storage across 500 databases |

**Why SQLite over Neo4j?** While Neo4j is a natural conceptual fit for family trees, SQLite with recursive CTEs covers 95% of genealogy queries with zero operational overhead. A single recursive CTE retrieves all ancestors or descendants efficiently, and SQLite handles 10,000+ person databases without issue. Neo4j requires Java, self-hosting, and adds complexity that isn't justified for a personal tool. If you later need graph queries like "find all paths between two people," PostgreSQL with Apache AGE adds Cypher query support without a separate database.

**Why Next.js over SvelteKit?** SvelteKit scores higher on solo-developer satisfaction surveys, but Next.js wins here because family-chart and Topola both have first-class React support, the Vercel AI SDK provides streaming Claude responses with minimal code, and the ecosystem has far more genealogy-adjacent examples and components.

### Database schema approach

```sql
-- Core tables
persons (id, given_name, surname, sex, birth_date, birth_place, 
         death_date, death_place, is_living, privacy_level, notes)
families (id, spouse1_id, spouse2_id, marriage_date, marriage_place)
children (family_id, person_id, child_order)
events (id, person_id, event_type, date, place, description, source_id)
sources (id, title, author, repository, url, citation_text)
media (id, file_path, mime_type, title, description)
media_links (media_id, person_id | family_id | event_id)

-- Ancestor query using recursive CTE
WITH RECURSIVE ancestors AS (
  SELECT p.id, p.given_name, p.surname, 0 as generation
  FROM persons p WHERE p.id = ?
  UNION ALL
  SELECT p.id, p.given_name, p.surname, a.generation + 1
  FROM persons p
  JOIN children c ON c.person_id = (SELECT id FROM ancestors)
  JOIN families f ON f.id = c.family_id
  WHERE p.id = f.spouse1_id OR p.id = f.spouse2_id
) SELECT * FROM ancestors;
```

---

## AI and ML techniques that matter most

### Record matching with Splink is the highest-impact AI feature

**Splink** (11,000+ GitHub stars, MIT license) implements the Fellegi-Sunter probabilistic record linkage model and can link 1 million records on a laptop in about a minute using DuckDB. It was used by Cambridge University to link all English and Welsh censuses from 1851–1921. For genealogy, it handles fuzzy name matching (Jaro-Winkler, Levenshtein), date tolerance (±1–3 years), and term-frequency adjustments for common versus rare names. It outputs match probabilities on a 0–1 scale: above 0.95 for auto-accept, 0.7–0.95 for human review, below 0.7 for rejection. This single library can power the "hints" system that makes Ancestry so valuable — but across free data sources.

### Claude API as a genealogy research co-pilot

A real-world project on GitHub (by @peas) documents 6 months of using Claude for Brazilian genealogy research: tracing families across 8+ generations, processing ~300 documents, creating 34+ structured YAML profiles, and running thousands of FamilySearch API queries. The key lesson: **"Documents are the source of truth. Process every document before researching online."** Another project, **autoresearch-genealogy**, provides 12 autonomous research prompts and 9 methodology documents specifically designed for Claude-powered genealogy work.

Practical Claude API use cases for this app include document summarization (extracting names, dates, relationships from OCR'd text), intelligent search query formulation (translating "find my great-grandmother born in Poland around 1880" into specific FamilySearch API queries), relationship explanation (computing and explaining how two people are related), historical context generation (what was life like in that ancestor's location and era), and research planning (analyzing the current tree state, identifying gaps, and suggesting which records to search next).

With a Claude Max subscription, the developer gets substantial API access through the Claude Code environment. For production app usage, the Claude API costs approximately $3 per million input tokens and $15 per million output tokens (Claude Sonnet), making document analysis affordable at scale.

### Document processing and OCR pipeline

For **printed historical text**, Tesseract (open-source, 100+ languages) achieves 95%+ accuracy on clean documents. For **handwritten documents** — the real challenge in genealogy — **Transkribus** is the industry leader with 300+ models covering scripts from the 9th century to today, including Kurrent, Sütterlin, and Fraktur. It offers a REST API with a free tier of 50–100 credits/month (one credit per handwritten page). For a fully open-source alternative, **Kraken OCR** or **eScriptorium** (self-hosted via Docker) provide comparable handwriting recognition.

The recommended pipeline: preprocess images with OpenCV (deskew, denoise, binarize) → detect layout with Transkribus or docTR → recognize text with Transkribus (handwriting) or Tesseract (print) → extract entities with Claude API (names, dates, places, relationships) → link extracted entities to tree profiles using Splink.

### Photo analysis for old family pictures

**DeepFace** (17,000+ stars) wraps 10 state-of-the-art face recognition models and can verify whether two faces match, find a face in a database, and even determine which parent a child resembles. For old, degraded photographs, the pipeline should first restore faces using **GFPGAN** or **CodeFormer** (both produce natural results on severely degraded photos), enhance backgrounds with **Real-ESRGAN** (2–4× upscaling), and optionally colorize with **DDColor** (state-of-the-art, ICCV 2023). Only then should face recognition be applied, using RetinaFace or MTCNN for detection (better on degraded images) and ArcFace for embedding comparison.

---

## Free data sources and APIs form the backbone

### Tier 1: Essential integrations (all free)

**FamilySearch API** is the centerpiece — a free, comprehensive REST API with OAuth 2.0 authentication, endpoints for genealogies, pedigree, search, records, memories, sources, and places (6 million+ locations). Rate limits are per-user (~18 seconds of execution time per minute window). Documentation is excellent with a sandbox environment. This gives access to 66 billion records including indexed census, vital, immigration, and military records.

**NARA Catalog API** provides free access to 26 million+ descriptions of US government records (census, military, immigration, presidential materials). All metadata is public domain. Requires an API key (free, request via email). Default 10,000 queries/month.

**Chronicling America (Library of Congress)** offers free full-text search of 21 million+ digitized newspaper pages from 1756–1963. No API key required. Excellent for finding obituaries, immigration notices, and local news about ancestors.

### Tier 2: Valuable additions (all free)

**Geni.com API** provides access to 200 million+ profiles in a collaborative world tree. **OpenArchives.org** covers Dutch and Belgian genealogical records with a clean REST API. **Europeana** aggregates 50 million+ European cultural heritage items. The **UK National Archives Discovery API** covers British government records.

### Tier 3: Notable gaps

Ancestry.com has no public API — the only integration path is GEDCOM export/import. FindAGrave (226 million+ memorials, owned by Ancestry) has no API. 23andMe's API was deprecated following its 2025 bankruptcy. For DNA integration, the approach must be local file parsing rather than API calls.

### DNA data integration approach

Raw DNA files from all major providers (23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA) use simple tab-delimited or CSV text formats containing rsid, chromosome, position, and genotype columns. These can be parsed directly in Python. For analysis, **PLINK** (industry-standard command-line tool) computes IBD segments and runs of homozygosity. **scikit-allel** provides population genetics analysis in Python. **cyvcf2** parses VCF files for whole-genome data. Local analysis capabilities include: format conversion between providers, shared DNA segment detection (IBD), basic ethnicity estimation against reference populations, and haplogroup prediction from Y-chromosome or mtDNA markers.

---

## Five-phase development roadmap

### Phase 1: Core tree builder + GEDCOM import (Weeks 1–6)

This phase delivers immediate personal utility — a working app where you can manage your family tree.

**Week 1–2: Project scaffold and data model**
- Initialize Next.js 15 with TypeScript, shadcn/ui, TailwindCSS
- Design and implement SQLite schema (persons, families, children, events, sources, media tables)
- Set up Drizzle ORM with better-sqlite3
- Implement basic CRUD API routes for persons and families
- Add authentication (NextAuth.js with a simple credentials provider for family access)

**Week 3–4: GEDCOM import/export**
- Integrate Topola's GEDCOM parser for 5.5.1 file import
- Build GEDCOM export using the same library (ensure living-person filtering)
- Map GEDCOM structures to your SQLite schema
- Handle common parsing edge cases (vendor-specific dialects, character encoding)
- Test with GEDCOM files from Gramps, FamilySearch, and any existing personal trees

**Week 5–6: Tree visualization**
- Integrate family-chart for interactive pedigree/family views (zoom, pan, click-to-focus)
- Add Topola for additional chart types (hourglass, descendants, ancestors)
- Implement person detail pages with events, sources, and media
- Build basic search and filtering across the tree
- Add living-person privacy controls (100-year threshold, hidden by default)

**Deliverable:** A functional personal genealogy app where you can import existing GEDCOM files, view and edit your family tree, and export clean GEDCOM files. Deploy locally or to Vercel.

### Phase 2: AI-powered record search and matching (Weeks 7–14)

This phase connects your tree to the world's free genealogy databases through AI.

**Week 7–9: FamilySearch API integration**
- Register for FamilySearch developer credentials and API key
- Implement OAuth 2.0 flow for user authentication
- Build search endpoints: person search, record search, place authority
- Create a "hints" panel that automatically queries FamilySearch for each person in your tree
- Display matching records with confidence indicators
- Allow one-click attachment of FamilySearch sources to tree profiles

**Week 10–12: Record matching engine**
- Set up Python FastAPI sidecar with Splink
- Configure Splink comparisons for genealogy: Jaro-Winkler on names (thresholds 0.9, 0.7), date comparison with year/month tolerance, exact match on birth place with term-frequency adjustment
- Build matching pipeline: pull candidate records from FamilySearch → block by surname → score with Splink → present ranked results
- Implement match review UI: accept, reject, maybe — with user feedback improving future matches

**Week 13–14: Claude AI research assistant**
- Integrate Claude API via Vercel AI SDK for a chat-based research assistant
- Build prompts for: "What should I research next?" (analyzes tree gaps), "Explain this record" (summarizes historical documents), "How are these people related?" (relationship computation)
- Add contextual AI — the assistant knows your tree structure and can make specific suggestions
- Implement NARA Catalog and Chronicling America search through the AI assistant

**Deliverable:** An AI-powered genealogy research tool that automatically finds matching records across free databases, scores matches probabilistically, and provides an intelligent chat assistant for research guidance.

### Phase 3: Document upload + OCR + AI extraction (Weeks 15–22)

This phase turns your physical family archives into searchable, linked digital records.

**Week 15–17: Document upload and management**
- Build file upload system (drag-and-drop, batch upload) for photos, letters, certificates, documents
- Implement media storage (local filesystem initially, Cloudflare R2 for web deployment)
- Create media gallery with tagging, person linking, and date assignment
- Build document viewer with zoom, rotate, and annotation tools

**Week 18–20: OCR pipeline**
- Integrate Tesseract (via pytesseract) for printed text recognition
- Add Transkribus API integration for handwritten document recognition
- Build preprocessing pipeline with OpenCV: deskew, denoise, contrast enhancement, binarization
- Implement batch OCR processing for large document collections

**Week 21–22: AI-powered extraction**
- Use Claude API to extract structured data from OCR'd text (names, dates, places, relationships, occupations)
- Build a review UI where extracted entities are highlighted and the user confirms or corrects
- Auto-suggest linking extracted persons to existing tree profiles (using Splink matching)
- Generate automatic source citations from document metadata

**Deliverable:** Upload a photo of great-grandmother's birth certificate → OCR extracts the text → Claude identifies names, dates, places → the app suggests linking to existing profiles and creates source citations automatically.

### Phase 4: Photo analysis + DNA integration (Weeks 23–30)

**Week 23–25: Photo AI features**
- Integrate face detection using DeepFace with RetinaFace backend
- Build face clustering: automatically group photos by detected individuals
- Implement face-to-person linking (detect face → match to known family members → tag automatically)
- Add photo enhancement: GFPGAN/CodeFormer for face restoration, Real-ESRGAN for background upscaling
- Optional: DDColor for black-and-white photo colorization

**Week 26–28: DNA data import and analysis**
- Build raw DNA file parsers for 23andMe, AncestryDNA, MyHeritage, FTDNA formats
- Store SNP data in a separate encrypted SQLite database (SQLCipher)
- Implement basic shared-segment detection between uploaded kits using custom IBD algorithm or PLINK integration
- Build chromosome browser visualization (inspired by DNA Painter)
- Calculate estimated relationships from shared DNA amounts (using centiMorgan-based probability tables)

**Week 29–30: DNA-tree integration**
- Link DNA profiles to tree persons
- Show predicted relationships alongside documentary evidence
- Highlight research opportunities: "You share 850 cM with this match — likely a first cousin. Check for shared great-grandparents."
- Export segment data for use with GEDmatch or DNA Painter

**Deliverable:** Upload raw DNA files from multiple family members → the app analyzes shared segments, estimates relationships, and integrates genetic evidence with your documentary tree.

### Phase 5: Advanced features and polish (Weeks 31–40)

**Week 31–33: Collaboration features**
- Add role-based family access (viewer, contributor, admin)
- Build a "family portal" where relatives can contribute photos, stories, and corrections
- Implement conflict detection and resolution for contributed data
- Add activity feed showing recent additions and changes

**Week 34–36: Narrative and visualization features**
- Use Claude API to generate ancestor biographies from tree data + attached sources
- Build migration path visualization with historical maps (using Leaflet.js + OpenStreetMap)
- Create printable family history reports (pedigree charts, narrative reports, photo books)
- Add timeline visualization showing family events in historical context

**Week 37–40: Polish and additional integrations**
- Add Geni.com API integration for world tree matching
- Implement GEDCOM 7.0 support via JsGEDCOM library
- Build data quality dashboard (missing sources, conflicting dates, incomplete profiles)
- Performance optimization for large trees (1,000+ persons)
- Mobile-responsive design refinement
- Comprehensive backup and export system

---

## Legal and privacy protections to implement from day one

### The household exemption is your primary shield

Under GDPR Article 2(2)(c), processing personal data "in the course of a purely personal or household activity" is exempt from GDPR requirements. For a self-hosted, private genealogy app used by you and your immediate family, this exemption almost certainly applies. **It ceases to apply if the app is publicly accessible on the internet** — the CJEU's *Lindqvist* decision established that publishing personal data online to an indefinite audience is not a personal activity. If you deploy to the web, restrict access strictly to authenticated family members.

### Five non-negotiable privacy features

First, implement a **living-person filter** using the industry-standard approach: any person born within 100–110 years with no recorded death date is presumed living. Living persons' details should display as "Private" or "Living" to anyone except the tree owner. This filter must apply to all exports, shared views, and API responses. Second, **encrypt the database at rest** using SQLCipher (encrypted SQLite) — especially critical if storing DNA data, which GDPR classifies as a "special category" requiring extra protection. Third, **strip living persons from GEDCOM exports** before any sharing — tools like GEDClean provide a model for this. Fourth, **never store DNA data in the cloud** without explicit consent from every person whose data is included. The Finland Data Protection Ombudsman explicitly advises against processing genetic data in genealogy because "an individual cannot give consent on behalf of another" and DNA data "concerns not just the individual but their relatives and future generations." Fifth, maintain **comprehensive GEDCOM backups** monthly — your data must be portable and never locked into your tool.

### The 23andMe cautionary tale

In March 2025, 23andMe filed for bankruptcy holding the genetic data of 15 million customers. Under bankruptcy law, this data became a sellable corporate asset. Nearly 2 million users deleted their data. State attorneys general urged the remaining customers to do the same. This incident demonstrates why **self-custody of family data is the most privacy-protective approach** and validates the architecture of a local-first personal tool over cloud-dependent commercial platforms.

---

## Open-source tools that accelerate every phase

The most impactful open-source accelerators, ranked by development time saved:

- **Gramps Web API** (Python, 190 stars, actively maintained) — a ready-made REST API that provides genealogical CRUD operations using the battle-tested Gramps library (20+ years of development). Could serve as your entire Python backend for genealogy data operations, saving weeks of schema and logic development.
- **Topola** (TypeScript, 256 stars, updated March 2026) — the only visualization library that both parses GEDCOM files and renders five genealogy-specific chart types. Has existing integrations with Gramps, webtrees, and WikiTree. Saves 2–3 weeks of visualization work.
- **family-chart** (JavaScript/D3, 680 stars, MIT) — purpose-built interactive family tree visualization with a Visual Builder that generates framework-specific code. Handles the complex layout problem of multi-parent relationships.
- **Splink** (Python, 11,000 stars) — production-grade probabilistic record linkage. Saves months compared to building matching from scratch.
- **autoresearch-genealogy** (GitHub) — 12 Claude Code prompts and 9 methodology documents specifically designed for AI-assisted genealogy research. Directly applicable as prompt templates for the Phase 2 AI assistant.
- **GFPGAN** (Python, 36,000 stars, Apache 2.0) — face restoration that transforms degraded old photos into clear images with one command. Drop-in integration for Phase 4 photo features.

Additionally, **python-gedcom** and **pygedcom** handle GEDCOM parsing in Python, **DeepFace** provides face recognition, **Transkribus** provides handwriting OCR via API, and **Real-ESRGAN** handles general image upscaling. All are free and open-source (or freemium with generous free tiers).

---

## Estimated timeline and effort summary

| Phase | Duration | Key Deliverable | Priority |
|-------|----------|----------------|----------|
| **Phase 1**: Core tree + GEDCOM | 6 weeks | Working personal tree app with GEDCOM import/export | Critical — use immediately |
| **Phase 2**: AI search + matching | 8 weeks | Auto-discovery of records across free databases | High — biggest research value |
| **Phase 3**: Document OCR + extraction | 8 weeks | Upload → OCR → AI extraction → auto-linking pipeline | High — digitizes physical archives |
| **Phase 4**: Photos + DNA | 8 weeks | Face recognition, photo restoration, DNA analysis | Medium — impressive but niche |
| **Phase 5**: Collaboration + polish | 10 weeks | Family portal, narratives, migration maps | Medium — share with family |

**Total: ~40 weeks (10 months)** working part-time, or ~20 weeks (5 months) working full-time. With Claude as a co-developer, expect **30–40% faster development** on code generation, debugging, and research tasks. The phased approach means you have a usable tool after just 6 weeks, with each subsequent phase adding transformative AI capabilities.

## Conclusion: what makes this worth building

The core insight driving this project is that **no existing tool combines local data ownership, cross-platform AI research, and modern developer experience**. Commercial platforms trap users in expensive subscriptions and walled gardens. Open-source tools lack AI capabilities. The FamilySearch API provides free access to the world's largest genealogy database, but no tool leverages it intelligently with modern AI. By building on SQLite (zero cost, full portability), Next.js (rapid development), and Claude (AI co-developer and runtime assistant), a solo developer can create something that doesn't exist in a $4.57-billion market: a private, intelligent genealogy research hub that gets smarter with every document processed and every record matched. Start with Phase 1 — import your existing GEDCOM file and see your family tree rendered in a tool you fully control.