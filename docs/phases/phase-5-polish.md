# Phase 5: AI Polish & Export

> Weeks 31-33 (3 weeks) | Started: TBD | Target: TBD

## Goals

- Generate AI-powered narrative biographies from tree data and sources
- Build data quality dashboard to identify research gaps
- Support GEDCOM 7.0 export for future compatibility
- Add narrative PDF export and optional photo book export
- Performance optimization across the full application

## Systems in Scope

- [AI Strategy](../architecture/ai-strategy.md)
- [Architecture Overview](../architecture/overview.md)

## Task Breakdown

### Week 31: AI Biography Generation & Historical Context

**Goal:** Generate narrative biographies from tree data.

- [ ] Create biography generation prompt in `apps/web/lib/ai/biography-prompts.ts`:
  - [ ] Input: person record, dates, places, events, sources, parents, children
  - [ ] Output: narrative biography (100-500 words)
  - [ ] Style: historical narrative, engaging, sourced from documented facts
  - [ ] Handle missing data gracefully
- [ ] Implement Claude biography API:
  - [ ] `POST /api/ai/generate-biography` -- generate for a person
  - [ ] Stream response for UI
  - [ ] Cache results to avoid re-generating
- [ ] Create biography UI:
  - [ ] New "Biography" tab in person detail
  - [ ] Display generated biography with styling
  - [ ] "Generate" / "Regenerate" button
  - [ ] Edit button for manual refinement
  - [ ] Export as text or PDF
- [ ] Add historical context:
  - [ ] For each ancestor, include era-appropriate context
  - [ ] Historical events, living conditions, typical occupations
  - [ ] Display as sidebar panel

### Week 32: Data Quality Dashboard & Performance Optimization

**Goal:** Identify data gaps and optimize performance.

- [ ] Create data quality metrics:
  - [ ] % of persons with complete names, dates, sources
  - [ ] % of relationships sourced
  - [ ] Missing: places, occupations, photos
  - [ ] Research recommendations based on gaps
- [ ] Build dashboard UI `apps/web/app/(auth)/analytics/quality/page.tsx`:
  - [ ] Summary cards: total persons, sourced %, coverage %
  - [ ] Charts: missing data by type
  - [ ] Breakdown by generation or branch
  - [ ] Sortable table of research priorities
- [ ] Performance optimization:
  - [ ] Profile database queries (timing in API logs)
  - [ ] Index analysis and query optimization
  - [ ] Pagination on all list endpoints (default 50)
  - [ ] Lazy loading for tree visualization
  - [ ] Optimize image sizes (resize on upload, thumbnails)
  - [ ] Client-side Web Vitals monitoring

### Week 33: GEDCOM 7.0 & Export Enhancements

**Goal:** Future-proof exports and add narrative output.

- [ ] Research and implement GEDCOM 7.0 export:
  - [ ] Map SQLite schema to GEDCOM 7.0 format
  - [ ] Top-level sources, precise dates, media links
  - [ ] Export route: `GET /api/export/gedcom?version=7.0`
- [ ] Build export options UI:
  - [ ] Format selector: GEDCOM 5.5.1, GEDCOM 7.0
  - [ ] Include/exclude: media, living persons, sources, DNA data
  - [ ] Character encoding options
- [ ] Add narrative PDF export:
  - [ ] Export family history as PDF
  - [ ] Include: pedigree chart, person narratives, photos, timeline
  - [ ] Customizable sections and layout
- [ ] Optional: photo book export:
  - [ ] Photo collection with captions
  - [ ] Generate print-ready PDF

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | AI biography generation |
| **Must** | Data quality dashboard (basic metrics) |
| **Must** | Performance optimization (queries, pagination, images) |
| **Should** | GEDCOM 7.0 export |
| **Should** | Narrative PDF export |
| **Should** | Historical context generation |
| **Could** | Photo book export |
| **Could** | Data quality charts/visualizations |

## Documentation (write during this phase)

- [ ] Biography feature user guide
- [ ] Export format comparison (GEDCOM 5.5.1 vs 7.0)
- [ ] Data quality metrics explanation

## Exit Gate: Phase 5 to Phase 6

- [ ] Biography generation produces coherent narratives for test persons
- [ ] Data quality dashboard shows accurate metrics
- [ ] Performance benchmarks met: API <500ms, page load <3s
- [ ] At least one export format (GEDCOM 5.5.1 or 7.0) works correctly

## Feedback Loop

- Share generated biographies with family members for accuracy/tone feedback
- Test exports by importing into Gramps or FamilySearch

## Key Risks

1. **Biography quality** -- Claude may generate inaccurate or bland biographies. Mitigate: include all available sources in prompt, allow manual editing, show sourced vs. inferred facts.
2. **Scope creep** -- Many "nice to have" features here. Mitigate: follow MoSCoW strictly; cut photo book and GEDCOM 7.0 first if behind.

## Decisions Made During This Phase

(Empty -- filled during implementation)

## Retrospective

(Empty -- filled at phase end)
