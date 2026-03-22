# Competitive Analysis

Analysis of 6 genealogy products to inform Ancstra's UX decisions. Focus on navigation, tree visualization, data entry, search, GEDCOM handling, and mobile experience.

---

## 1. Ancestry.com

**Market position:** Market leader, subscription-based ($300+/yr), largest record database (40B+ records)

**Navigation & IA:**
- Top nav bar with mega-dropdown menus (Trees, Search, DNA, Extras)
- Tree lives under "Trees" tab — not the primary landing
- Complex multi-level navigation reflects decades of feature accretion
- Separate sections for DNA, search, community — feels fragmented

**Tree Visualization:**
- Pedigree chart (default), family view, fan chart
- Click person to open side panel with quick facts
- Zoom/pan via mouse, but no touch-optimized experience
- Green "hints" leaf icon on persons with record matches — highly effective discovery cue
- Tree feels dated visually but is functional

**Person Entry:**
- Form-heavy: many optional fields shown upfront
- "Add Father/Mother/Spouse/Child" contextual from person card — good pattern
- Source attachment is buried, not encouraged during entry
- Duplicate detection on save (warns of similar persons)

**Search/Filter:**
- Powerful record search across databases
- Person search within tree is basic typeahead
- No advanced in-tree filtering (by generation, completeness, etc.)

**GEDCOM:**
- Import: upload + processing, decent progress indication
- Export: available but not prominently featured
- Import quality varies — some data loss with complex GEDCOMs

**Mobile:**
- Dedicated app, but feature-limited compared to web
- Tree view is cramped on phone screens
- Record search works well on mobile

**Strengths to adopt:** Contextual "Add relative" from person cards, hint/leaf discovery indicator, pedigree as default view
**Weaknesses to avoid:** Subscription lock-in, fragmented navigation, visually dated UI, overwhelming forms, poor mobile tree experience

---

## 2. FamilySearch.org

**Market position:** Free, LDS-backed, collaborative single world tree, 66B+ records

**Navigation & IA:**
- Clean top nav: Family Tree, Search, Memories, Activities
- Tree is front-and-center — good prioritization
- "Activities" section has genealogy learning resources — onboarding

**Tree Visualization:**
- Fan chart (unique, visually appealing), pedigree, descendancy, portrait pedigree
- Fan chart is the signature feature — great for showing to family
- Smooth zoom/pan, good performance even with large trees
- Person detail opens in a side panel on click — good pattern
- Color-coded tree nodes (green = complete, amber = needs work)

**Person Entry:**
- Clean, focused form with progressive disclosure
- "Add Unconnected Person" vs "Add Relative" — clear distinction
- Standardized place names with autocomplete (excellent)
- Source attachment is well-integrated into the workflow
- Date formats are flexible and forgiving

**Search/Filter:**
- Excellent record search with faceted filtering
- Person search in tree is quick and intuitive
- Historical record viewer is best-in-class

**GEDCOM:**
- Import creates a separate tree (doesn't merge into world tree)
- Export available for portions of the tree
- Good GEDCOM support overall

**Mobile:**
- Excellent native app — one of the best in genealogy
- Tree view adapts well to touch (pinch zoom, tap to select)
- Camera integration for document capture
- Offline access for portions of the tree

**Strengths to adopt:** Fan chart visualization, clean progressive forms, place autocomplete with standardization, color-coded completeness, excellent mobile experience
**Weaknesses to avoid:** Collaborative world tree (privacy concerns), some UI complexity for new users, occasional data quality issues from open editing

---

## 3. MyHeritage

**Market position:** International focus, freemium with subscription, DNA integration, Smart Matches

**Navigation & IA:**
- Top nav: Family Tree, Discoveries, DNA, Search, Photos
- "Discoveries" prominently featured — discovery-first approach
- Clean, modern feel compared to Ancestry

**Tree Visualization:**
- Classic pedigree (default), timeline view, family view
- "Smart Matches" indicators on tree nodes — records from other users' trees
- Photo-centric nodes (shows actual photos when available)
- Tree builder is drag-and-drop capable
- Good zoom/pan with responsive performance

**Person Entry:**
- Streamlined forms with fewer required fields
- Quick add: just name and relationship — expand later
- Photo upload integrated into person creation
- "Add relative" is very contextual and intuitive

**Search/Filter:**
- Global search across records and trees
- "Smart Matches" algorithm automatically finds potential matches
- SuperSearch for advanced queries across all databases

**GEDCOM:**
- Import: clean process, good vendor dialect handling
- Export: full GEDCOM with privacy options
- Good roundtrip fidelity

**Mobile:**
- Solid native app with tree viewing and editing
- Camera for document/photo capture
- Push notifications for new discoveries

**Strengths to adopt:** Quick-add flow (name + relationship first), photo-centric person nodes, Smart Match indicators, clean modern design
**Weaknesses to avoid:** Freemium limitations feel restrictive, some feature overload, discovery notifications can feel spammy

---

## 4. Gramps

**Market position:** Free, open-source desktop app, power-user focused

**Navigation & IA:**
- Desktop app with sidebar navigation (People, Relationships, Families, Charts, etc.)
- Category-based navigation — data-model-centric, not task-centric
- Overwhelming for new users, powerful for experienced researchers
- Plugin system adds features but adds complexity

**Tree Visualization:**
- Multiple chart types: pedigree, fan, descendancy, timeline, relationship
- Charts are functional but not visually polished
- Export to PDF/SVG for printing — good quality
- Performance can suffer with very large trees

**Person Entry:**
- Comprehensive forms with every possible field
- Tab-based interface: General, Events, Names, Sources, Galleries, etc.
- Supports complex genealogical data (alternate names, multiple events)
- Source citation management is excellent (best-in-class for researchers)

**Search/Filter:**
- Advanced filtering by any field combination
- Custom filters and rules engine
- Powerful but complex — not intuitive for beginners

**GEDCOM:**
- Excellent GEDCOM support (best dialect handling of any tool)
- Import/export with detailed mapping options
- Handles edge cases and vendor quirks well

**Mobile:**
- No mobile app — desktop only
- Web interface exists (Gramps Web) but limited

**Strengths to adopt:** Comprehensive data model, excellent source citation management, robust GEDCOM handling, powerful filtering
**Weaknesses to avoid:** Steep learning curve, dated UI, desktop-only, data-model-centric navigation (confusing for non-experts), overwhelming forms

---

## 5. WikiTree

**Market position:** Free, collaborative single world tree, community-driven

**Navigation & IA:**
- Top nav: Find, Edit, Add, Categorization, Help
- Profile-centric (each person has a wiki-style profile page)
- Community features prominent (forums, DNA connections, projects)

**Tree Visualization:**
- Dynamic tree with expandable branches
- Compact tree, fan chart, descendancy views
- Interactive ancestor view with drag/zoom
- Clean, simple node design

**Person Entry:**
- Wiki-style editing with structured fields
- Merge system for duplicate persons (collaborative)
- "Pre-1500 Profiles" policy (prevents unreliable ancient claims)
- Strong sourcing requirements for new additions

**Search/Filter:**
- Person search by name, dates, location
- "DNA Connections" feature links DNA matches to tree persons
- Community search for finding collaborators

**GEDCOM:**
- Import creates draft profiles (community review before merge)
- Export available for personal data
- GEDCOM Gedcom import quality is decent

**Mobile:**
- Responsive web design (no native app)
- Usable but not optimized for mobile tree viewing

**Strengths to adopt:** Clean tree node design, strong sourcing culture, community features for Phase 5
**Weaknesses to avoid:** Wiki-style editing is confusing, collaborative world tree (privacy), no native mobile experience

---

## 6. MacFamilyTree / MobileFamilyTree

**Market position:** Premium native apps (macOS/iOS), one-time purchase, strong visualization

**Navigation & IA:**
- Native app with sidebar: Persons, Families, Events, Places, Sources, Media
- Clean macOS/iOS native design language
- Feels premium and polished

**Tree Visualization:**
- Best-in-class visualizations: interactive globe, timeline, 3D charts, virtual tree
- Hourglass, fan chart, pedigree, descendancy — all beautifully rendered
- Smooth animations and transitions
- "Virtual Tree" (3D tree with leaves representing persons) — unique but gimmicky

**Person Entry:**
- Clean native forms with platform-appropriate controls
- Date picker handles genealogical dates well
- Photo integration via system photo picker
- Quick entry mode for batch additions

**Search/Filter:**
- Smart search with auto-complete
- Person filtering by various criteria
- Statistics and reports for data quality

**GEDCOM:**
- Good GEDCOM import/export
- Syncs between Mac and iOS versions via iCloud

**Mobile:**
- Excellent iOS app — best mobile genealogy experience
- Optimized for touch (tree viewing, person editing)
- Camera integration for document capture
- Offline-first with iCloud sync

**Strengths to adopt:** Beautiful visualizations, native-quality polish, excellent mobile experience, genealogical date handling, offline-first architecture
**Weaknesses to avoid:** Platform-locked (Apple only), one-time purchase limits ongoing development, no web version

---

## Key Takeaways for Ancstra

### Best UX Patterns to Adopt

1. **Contextual "Add Relative"** (Ancestry, MyHeritage) — Add Father/Mother/Spouse/Child directly from person detail, not a global form
2. **Pedigree as default tree view** (all competitors) with alternate views accessible via tabs/dropdown
3. **Person detail as side panel** (Ancestry, FamilySearch) — click person on tree, detail slides in from right
4. **Quick-add flow** (MyHeritage) — just name + sex + relationship first, expand details later (progressive disclosure)
5. **Place autocomplete with standardization** (FamilySearch) — normalize place names, suggest existing places
6. **Completeness indicator** (FamilySearch) — color-coded visual showing how complete a person's data is
7. **Flexible date input** (FamilySearch, MacFamilyTree) — accept multiple formats, parse intelligently, support modifiers
8. **Source encouragement** (WikiTree, Gramps) — gently promote source attachment without requiring it

### Common Pain Points to Solve

1. **Form overwhelm** — Too many fields shown upfront (Gramps, Ancestry). Solution: progressive disclosure, quick-add mode
2. **Poor mobile tree viewing** — Most competitors struggle here. Solution: full-screen canvas, touch-optimized, bottom sheet for detail
3. **Data lock-in** — Subscription platforms make export hard. Solution: local-first SQLite, clean GEDCOM export, $0 hosting
4. **Dated UI** — Most tools look like they were designed in 2010. Solution: modern shadcn/ui components, clean typography, OKLCH colors
5. **Steep learning curve** — Genealogy jargon alienates new users. Solution: plain language labels, guided onboarding, empty-state guidance
6. **No offline support** — Web tools need internet. Solution: PWA with service worker, SQLite local database

### Ancstra's Differentiation

| Differentiator | vs Ancestry/MyHeritage | vs FamilySearch | vs Gramps | vs WikiTree |
|---------------|----------------------|----------------|-----------|-------------|
| **$0/month** | No subscription | Already free | Already free | Already free |
| **Data ownership** | SQLite file you control | Shared world tree | Local file | Shared world tree |
| **Privacy-first** | Subscription for privacy | Public profiles | Good | Public profiles |
| **AI-powered** | Basic hints | No AI | No AI | No AI |
| **Modern UI** | Dated design | Clean but old | Very dated | Wiki-style |
| **Offline-first** | Requires internet | Partial offline | Full offline | Requires internet |
| **Open data format** | Proprietary + GEDCOM | GEDCOM | GEDCOM + XML | Limited export |
