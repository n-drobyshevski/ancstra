# Ancstra — AI-Powered Personal Genealogy App

## Quick Context
- Solo dev + Claude co-developer
- Next.js 16 + TypeScript + shadcn/ui + Tailwind CSS v4 + React 19
- SQLite (better-sqlite3 / Drizzle ORM) locally, Turso for web
- JS/TS only — no Python sidecar (see docs/architecture/decisions/001-js-over-python.md)
- Vercel AI SDK + Claude API for AI features
- family-chart + Topola for tree visualization
- Monorepo: pnpm + Turborepo

## Key Docs
- Project index: docs/INDEX.md
- Current phase: docs/phases/phase-1-core.md
- Data model: docs/architecture/data-model.md
- Architecture: docs/architecture/overview.md
- AI strategy: docs/architecture/ai-strategy.md

## Critical Constraints
- AI/API discoveries create `proposed_relationships` (never directly modify tree)
- GEDCOM imports are auto-trusted (`validation_status='confirmed'`)
- Living-person filter: born within 100yr + no death = presumed living
- All relationships from external sources go through validation pipeline
- RBAC roles: owner, admin, editor, viewer
