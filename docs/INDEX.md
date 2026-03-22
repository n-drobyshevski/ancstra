# Ancstra — Planning Index

## Quick Links
- [Vision & Scope](vision.md)
- [Architecture Overview](architecture/overview.md)
- [Data Model](architecture/data-model.md)
- [AI Strategy](architecture/ai-strategy.md)
- [Information Architecture](design/information-architecture.md)

## System Specs

| System | Spec | Phase | Depth | Status |
|--------|------|-------|-------|--------|
| GEDCOM Import/Export | [spec](specs/gedcom-import.md) | 1 | impl-ready | Not Started |
| Tree Visualization | [spec](specs/tree-visualization.md) | 1 | impl-ready | Not Started |
| Relationship Validation | [spec](specs/relationship-validation.md) | 2 | design | Not Started |
| FamilySearch API | [spec](specs/familysearch-api.md) | 2 | design | Not Started |
| AI Research Assistant | [spec](specs/ai-research-assistant.md) | 2 | design | Not Started |
| Record Matching | [spec](specs/record-matching.md) | 2 | design | Not Started |
| Research Workspace | [spec](superpowers/specs/2026-03-22-research-workspace-design.md) | 2 | approved | Not Started |
| Document Processing | [spec](specs/document-processing.md) | 3 | design | Not Started |
| Photo Analysis | [spec](specs/photo-analysis.md) | Post-launch | design | Not Started |
| DNA Integration | [spec](specs/dna-integration.md) | Post-launch | design | Not Started |
| Collaboration | [spec](specs/collaboration.md) | 4 | design | Not Started |

## Design Artifacts

| Artifact | Location | Status |
|----------|----------|--------|
| Competitive Analysis | [competitive-analysis](design/competitive-analysis.md) | Done |
| Proto-Personas | [personas](design/personas.md) | Done |
| User Stories (Phase 1) | [user-stories](design/user-stories-phase1.md) | Done |
| Information Architecture | [info-architecture](design/information-architecture.md) | Done |
| User Flows | [user-flows](design/user-flows.md) | Done |
| Design System | [design-system](design/design-system.md) | Done |
| Component Inventory | [components](design/component-inventory.md) | Done |
| UX Roadmap (Phases 2-5) | [ux-roadmap](design/ux-roadmap-phases2-5.md) | Done |
| Figma Design Sprint Plan | [figma-sprint](design/figma-design-sprint.md) | Done |

## Phase Plans

| Phase | Plan | Duration | Status |
|-------|------|----------|--------|
| 0: UX/UI Design | [phase-0-design](phases/phase-0-design.md) | ~3 weeks | In Progress |
| 0.5: Technical Spikes | [phase-0.5-spikes](phases/phase-0.5-spikes.md) | 1 week | Not Started |
| 1: Core Tree Builder | [phase-1-core](phases/phase-1-core.md) | 8 weeks | Not Started |
| 2: AI Search, Research & Matching | [phase-2-search](phases/phase-2-search.md) | 12 weeks | Not Started |
| 3: Document Processing | [phase-3-documents](phases/phase-3-documents.md) | 7 weeks | Not Started |
| 4: Auth & Collaboration | [phase-4-auth](phases/phase-4-auth.md) | 4 weeks | Not Started |
| 5: AI Polish & Export | [phase-5-polish](phases/phase-5-polish.md) | 3 weeks | Not Started |
| 6: Deployment & Launch | [phase-6-launch](phases/phase-6-launch.md) | 3 weeks | Not Started |
| 6.5: Beta Period | [phase-6.5-beta](phases/phase-6.5-beta.md) | 2 weeks | Not Started |
| Post-launch: Photos & DNA | [future-enhancements](phases/future-enhancements.md) | ~16-19 weeks | Not Started |

**Total to launch: ~46.5 weeks (~11.5 months)** including buffer weeks between phases.

## Architecture Decisions

- [ADR-001: JS/TS over Python](architecture/decisions/001-js-over-python.md)
- [ADR-002: SQLite local-first](architecture/decisions/002-sqlite-local-first.md)
- [ADR-003: Gramps as reference only](architecture/decisions/003-gramps-reference-only.md)
- [ADR-004: family-chart for visualization](architecture/decisions/004-family-chart-viz.md)

## Reference

- [Original research](research/first_research.md)
- [Archived full spec](archive/2026-03-21-original-full-spec.md)
