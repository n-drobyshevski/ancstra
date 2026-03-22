# Phase 0: UX/UI Design

**Duration:** ~13 working days (3 calendar weeks)
**Prerequisite:** None (documentation-only state)
**Gate to Phase 1:** All Phase 1 screens have approved hi-fi mockups in Figma

---

## Overview

A design-first phase that produces all UX/UI artifacts before coding begins. Lightweight UX research (proto-personas, no formal interviews), Figma for all visual deliverables, with detailed design for Phase 1 and a high-level UX roadmap for Phases 2-5.

## Figma File

Single project file: **"Ancstra — Design System & Screens"**

```
Ancstra Design
├── Cover Page (project name, version, date, phase status)
├── 0. Research
│   ├── Competitive Analysis Board
│   └── Proto-Personas
├── 1. Information Architecture
│   ├── Site Map
│   ├── Content Hierarchy
│   └── Genealogy Taxonomy
├── 2. User Flows
│   ├── Add Person (Manual Entry)
│   ├── Import GEDCOM
│   ├── Navigate Tree
│   ├── Search & Filter
│   ├── Edit Person
│   └── Link Relationships
├── 3. Wireframes (Lo-Fi)
│   ├── Desktop (1280px)
│   │   ├── Dashboard / Home
│   │   ├── Tree View
│   │   ├── Person Detail Panel
│   │   ├── Person Create/Edit Form
│   │   ├── GEDCOM Import Flow
│   │   ├── GEDCOM Export Flow
│   │   └── Search & Filter
│   └── Mobile (375px)
│       ├── Tree View
│       ├── Person Detail
│       └── Forms
├── 4. Design System
│   ├── Colors (OKLCH palette)
│   ├── Typography Scale
│   ├── Spacing & Grid
│   ├── Component Library (shadcn/ui mappings)
│   ├── Icons (Lucide)
│   └── Dark Mode Variants
├── 5. Hi-Fi Mockups (Phase 1)
│   ├── Desktop (1280px)
│   │   ├── Dashboard / Home
│   │   ├── Tree View (family-chart pedigree)
│   │   ├── Tree View (Topola hourglass)
│   │   ├── Person Detail Panel (slide-out)
│   │   ├── Person Create Form
│   │   ├── Person Edit Form
│   │   ├── GEDCOM Import (upload + progress + summary)
│   │   ├── GEDCOM Export (privacy selector)
│   │   ├── Search Results + Filters
│   │   └── Settings
│   └── Mobile (375px + 768px)
└── 6. UX Roadmap (Phases 2-5)
    ├── Phase 2: AI Search & Matching
    ├── Phase 3: Document Processing
    ├── Phase 4: Photos & DNA
    └── Phase 5: Collaboration
```

---

## Step-by-Step Workflow

### Step 0.1: Competitive Analysis + Proto-Personas (2 days)

**Day 1 — Competitive Analysis:**
- Analyze 6 competitors: Ancestry, FamilySearch, MyHeritage, Gramps, WikiTree, MacFamilyTree
- For each, capture: navigation/IA, tree visualization, person entry workflow, search/filter, GEDCOM UX, mobile experience
- Screenshot into Figma "Competitive Analysis Board"
- Key questions:
  - How do competitors handle "add a relative" (contextual vs global)?
  - What tree visualization interactions feel natural?
  - How do competitors show person completeness / data quality?
  - What onboarding works for first-time users with no data?
- Write summary: `docs/design/competitive-analysis.md`

**Day 2 — Proto-Personas:**
- Define 3 proto-personas:
  1. **Margaret, Dedicated Researcher** (primary) — 55-70, retired, 10+ hrs/week, existing GEDCOM files
  2. **Alex, Family Historian** (secondary) — 30-45, documenting for kids, starting small
  3. **Jordan, Casual Explorer** (tertiary) — 20-35, curious after DNA test
- Map needs, goals, pain points, tech comfort for each
- Document: `docs/design/personas.md`

**Done criteria:**
- [ ] 6 competitors analyzed with screenshots
- [ ] 3 personas documented with needs, goals, pain points
- [ ] Key UX patterns identified for adoption

---

### Step 0.2: User Stories + Information Architecture (2 days)

**Day 3 — User Stories:**
- Write stories for Phase 1, grouped by epic: Person Management, Tree Visualization, GEDCOM Import/Export, Search & Navigation, Dashboard
- MoSCoW prioritization (Must / Should / Could / Won't)
- ~25-30 stories total
- Document: `docs/design/user-stories-phase1.md`

**Day 4 — Information Architecture:**
- Design site map and navigation structure
- Define navigation pattern: left sidebar (desktop), bottom tabs (mobile), global Cmd+K search
- Content hierarchy for person detail panel
- Genealogy taxonomy (event types, name types, date modifiers, validation statuses, source types)
- Document: `docs/design/information-architecture.md`

**Done criteria:**
- [ ] All Phase 1 features have user stories with MoSCoW priority
- [ ] Site map covers all Phase 1 routes
- [ ] Navigation pattern defined for desktop and mobile
- [ ] Genealogy taxonomy complete

---

### Step 0.3: User Flows (2 days) — PARALLEL with Step 0.4

**Days 5-6 — Core Task Flows:**
6 flows with happy paths + error/edge cases:
1. Add Person (Manual Entry) — global + contextual (from tree)
2. Import GEDCOM — 5-step wizard
3. Navigate Tree — zoom/pan, click, switch views
4. Search & Filter — typeahead + full results
5. Edit Person — inline + full page
6. Link Relationships — add spouse/parent/child

- Create as Figma flow diagrams
- Document: `docs/design/user-flows.md`

**Done criteria:**
- [ ] 6 flows diagrammed with happy paths
- [ ] Error/edge cases documented
- [ ] State transitions identified
- [ ] Each flow maps to specific screens

---

### Step 0.4: Design System Foundation (2 days) — PARALLEL with Step 0.3

**Day 7 — Color, Typography, Spacing:**
- OKLCH color palette (primary, secondary, accent, semantic, genealogy-specific)
- Dark mode variants
- Typography scale with semantic mappings
- Spacing grid, breakpoints, layout dimensions
- Document: `docs/design/design-system.md`

**Day 8 — Components, Icons, Dark Mode:**
- shadcn/ui component inventory (~20 components)
- 8 custom components: genealogical date input, place autocomplete, person search/select, tree node, relationship link, mini-map, completion indicator, timeline
- Lucide icon mapping
- WCAG AA contrast verification
- Document: `docs/design/component-inventory.md`

**Done criteria:**
- [ ] OKLCH palette defined with light + dark
- [ ] Typography mapped to semantic uses
- [ ] All shadcn/ui components identified
- [ ] Custom component specs documented
- [ ] Lucide icons selected

---

### Step 0.5: Lo-Fi Wireframes (3 days)

Grayscale wireframes in Figma at 1280px + 375px.

**Day 9:** Dashboard, Tree View, Person Detail Panel
**Day 10:** Person Forms, Genealogical Date Input, GEDCOM Import/Export
**Day 11:** Search & Filter, Mobile variants, Settings

All screens include: default, empty, loading, and error states.

**Done criteria:**
- [ ] Every screen in site map has a wireframe
- [ ] Desktop + mobile variants for key screens
- [ ] All user flows traceable through wireframes
- [ ] Empty/loading/error states designed

---

### Step 0.6: Hi-Fi Mockups (3 days)

Apply design system to wireframes with shadcn/ui patterns.

**Day 12:** Tree View (hero screen) + Person Detail Panel
**Day 13:** Person Forms + GEDCOM Import flow
**Day 14:** Dashboard + Search + Export + Settings + dark mode variants

Create interactive Figma prototype for "Add Person from Tree" flow.

**Done criteria:**
- [ ] All Phase 1 screens have hi-fi mockups
- [ ] Design system consistently applied
- [ ] Dark mode variants for tree view + dashboard
- [ ] Mobile variants for key screens
- [ ] Empty/loading/error states
- [ ] Interactive prototype for core flow

---

### Step 0.7: UX Roadmap for Phases 2-5 (1 day)

**Day 15:** Document UX challenges, patterns to research, and components to plan early for each future phase.

- Phase 2: Match review queue, AI chat UI, confidence scores
- Phase 3: OCR viewer, entity extraction, citation generation
- Phase 4: Face detection, chromosome browser, DNA consent
- Phase 5: Invitation flows, role-based UI, conflict resolution

Establish cross-phase design principles:
1. Progressive disclosure
2. Context-preserving navigation
3. Undo-friendly actions
4. Source-first culture
5. Privacy-visible
6. Mobile-viable

Document: `docs/design/ux-roadmap-phases2-5.md`

**Done criteria:**
- [ ] Each future phase has UX challenges identified
- [ ] Design patterns to research listed
- [ ] Components needing early design called out
- [ ] Design principles established

---

## Early Risk Mitigation (Do Now)

- [ ] **Register for FamilySearch developer account** -- approval can take weeks; don't wait until Phase 2
  - [ ] Apply at https://www.familysearch.org/developers/
  - [ ] Request sandbox + production client credentials
  - [ ] Add to `.env.example` as placeholder
- [ ] **Create Transkribus account** -- register for free API access (Phase 3 dependency)

---

## Gate: Phase 0 → Phase 1

Before starting Phase 1 implementation, verify:
- [ ] All Phase 1 screens have approved hi-fi mockups
- [ ] Design system tokens defined and documented
- [ ] Component inventory maps to shadcn/ui
- [ ] User flows cover all Phase 1 features
- [ ] Mobile responsive considerations documented
- [ ] Dark mode variants for key screens
- [ ] Empty/loading/error states designed
- [ ] `docs/design/` folder has all 8 markdown deliverables

---

## How Phase 0 Feeds Phase 1

| Phase 0 Output | Phase 1 Week |
|----------------|-------------|
| Design system (colors, type, spacing) | Week 1 — configure Tailwind v4 CSS variables |
| Component inventory | Week 1 — install shadcn/ui components |
| Person form mockups | Week 2-3 — build CRUD forms |
| GEDCOM import flow | Week 3-4 — build import UI |
| GEDCOM export flow | Week 4-5 — build export UI |
| Tree view + detail panel mockups | Week 5-6 — family-chart integration |
| Search/filter mockups | Week 6-7 — build search UI |
| User flows | All weeks — acceptance criteria |
| Mobile wireframes | All weeks — responsive implementation |
| Genealogy taxonomy | All weeks — enum values and UI labels |

---

## Duration Summary

| Step | Description | Days | Cumulative |
|------|-------------|------|------------|
| 0.1 | Competitive Analysis + Personas | 2 | 2 |
| 0.2 | User Stories + IA | 2 | 4 |
| 0.3 | User Flows (parallel w/ 0.4) | 2 | 6 |
| 0.4 | Design System (parallel w/ 0.3) | 2 | 6 |
| 0.5 | Lo-Fi Wireframes | 3 | 9 |
| 0.6 | Hi-Fi Mockups | 3 | 12 |
| 0.7 | UX Roadmap | 1 | 13 |
| — | Buffer / iteration | 1-2 | 14-15 |

**Total: ~3 calendar weeks**

---

## Detailed Figma Sprint Plan

For the exhaustive screen-by-screen, component-by-component breakdown of the remaining Figma work (Steps 0.3R through 0.6), see:

**[Figma Design Sprint Plan](../design/figma-design-sprint.md)** (~2,500 lines)

Covers: Figma file organization, flow diagrams, design system components (28 base + 8 custom), all wireframes (24 desktop + 11 mobile + 3 tablet), hi-fi mockup plan, state matrix, responsive breakpoints, dark mode specs, accessibility checklists, design token mappings, edge cases, and interactive prototype specs.

---

## Design Decisions (Resolved 2026-03-22)

| # | Question | Decision |
|---|----------|----------|
| 1 | Tree view type switching | Instant re-render + 300ms fitView animation |
| 2 | Person edit UX | Both inline (panel) + full edit page |
| 3 | Drag-to-create-edge | Deferred to Phase 2 |
| 4 | Mobile tree node drag | Pan/zoom only, no node reposition |
| 5 | Empty state style | Icon + text only (Lucide icon + heading + CTAs) |
| 6 | Cmd+K scope | Search + Actions (full command palette) |
| 7 | PersonNode avatar | Show avatar slot now (initials fallback) |
| 8 | Detail panel width | Resizable (drag edge, min/max bounds, persist) |
| 9 | Tablet sidebar | Always show icon-only (64px) |
| 10 | GEDCOM import merge | Show "no merge" notice when tree has data |
| 11 | Settings scope (Phase 1) | Privacy + Data + Theme only |
| 12 | Tree page Tab order | Top bar → Sidebar → Toolbar → Canvas → Panel |
