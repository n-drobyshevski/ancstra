# Ancstra Product Vision

## One-liner

A privacy-first, AI-powered genealogy tool that acts as a personal research command center — searching free data sources, keeping data locally owned, and using Claude AI to break through research walls, all for $0/month in hosting costs.

## Target User

Solo genealogy researchers who want complete data ownership, local-first privacy, and intelligent AI assistance across multiple free genealogy databases.

## Core Value Propositions

- **Local data ownership.** Your family tree lives in a single SQLite file on your computer. You control it entirely. No subscriptions, no data sells, no lock-in.
- **Cross-platform AI research.** Search across FamilySearch (66 billion records), NARA (26 million+ US government records), and Chronicling America (21 million+ newspaper pages) through a single intelligent interface.
- **Free data sources.** All core integrations (FamilySearch, NARA, Chronicling America) are completely free with no API costs or rate limits that matter.
- **Intelligent research assistant.** Claude AI knows your family tree and can analyze documents, match records, explain historical context, and suggest next research steps.
- **Modern developer experience.** Built on Next.js 16, React 19, TypeScript, shadcn/ui — rapid development, full data ownership, no Python infrastructure overhead.

## Non-Goals

- **Not a social network.** No collaborative cloud platform, no public profiles, no "share your tree with the world."
- **Not competing with Ancestry as a service.** Ancestry charges $319–$720/year for access to 60 billion records. Ancstra uses free sources and costs $0/month to host and run.
- **Not a hosted SaaS platform.** The app runs locally or can be self-hosted to Vercel. It doesn't require a corporate server to run.
- **Not a DNA analysis tool.** DNA features are optional local analysis (shared segment detection, relationship estimation) — never cloud-stored without explicit consent.
- **Not supporting real-time collaboration at scale.** Multi-user support is scoped to small family groups (5-20 people) with role-based access, not wikitree-style open editing.

## Success Criteria

| Metric | Target | Why |
|--------|--------|-----|
| **Phase 1 delivery** | 6-8 weeks | Working personal genealogy app with GEDCOM import/export before moving to AI features |
| **Data import** | 100% GEDCOM fidelity, 95%+ vendor dialect handling | Users must be able to import existing trees and export clean files for portability |
| **AI research quality** | 80%+ precision on record matches, 90%+ user satisfaction with search suggestions | AI integration must feel more helpful than random searching |
| **No hosting cost** | $0/month for personal use (local or Vercel free tier) | Core value prop is zero infrastructure cost |
| **User data ownership** | Entire database = one portable SQLite file | Users must feel confident they own their data |
| **Record coverage** | 93B+ records accessible across 3+ free APIs | Larger than Ancestry's 60B, all free |
| **Privacy compliance** | Living-person filter, GDPR household exemption, no required cloud storage | Safe for EU/GDPR use without extensive legal overhead |

## Tech Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 16 (App Router) + TypeScript + shadcn/ui + Tailwind CSS v4 | Largest ecosystem, Vercel AI SDK, server components, React 19, accessibility built-in |
| **Database** | SQLite (local) / Turso (web) | Zero infrastructure cost, full portability, recursive CTEs for genealogy queries |
| **ORM** | Drizzle ORM | Type-safe SQL, excellent TypeScript support, works with both better-sqlite3 and libsql |
| **Tree visualization** | family-chart + Topola | 5 chart types, GEDCOM-native parsing, interactive and printable |
| **AI** | Vercel AI SDK + Claude API | Streaming responses, tool calling, genealogy co-pilot patterns |
| **OCR** | tesseract.js (printed) + Transkribus API (handwritten) | JS runtime for printed, REST API for handwriting (50-100 free credits/month) |
| **Record matching** | Custom TypeScript matcher (Jaro-Winkler + Fellegi-Sunter) | MVP-ready; upgrade path to Splink sidecar if needed |
| **Face detection** | face-api.js (TensorFlow.js) | Local face detection and clustering; cloud APIs (Replicate) for enhancement |
| **Build tooling** | pnpm + Turborepo | Monorepo management, cache, parallelization |
| **Hosting** | Vercel (free tier) + optional self-hosting | $0/month achievable with Vercel's free tier; export any time |

## Development Philosophy

1. **Local-first, cloud-later.** Build for local SQLite first (perfect for development and personal use). The Drizzle ORM abstracts to Turso (libsql) when web deployment is needed — no architecture change.
2. **JavaScript/TypeScript everywhere.** Single runtime reduces deployment complexity and debugging surface. Python-dependent features (OCR, face detection) use cloud APIs or WASM-compiled alternatives.
3. **Privacy by design, from day one.** Living-person filters, no cloud requirement, encrypted DNA storage, soft deletes for GDPR compliance.
4. **Phased, usable releases.** Phase 1 delivers a working tree builder in 6-8 weeks. Each phase thereafter adds transformative features (AI search, document OCR, photo analysis, DNA, collaboration).
5. **Open data standards.** GEDCOM import/export must be perfect. Users can always leave Ancstra with their data intact.

---

## Related Documentation

- [Architecture Overview](architecture/overview.md) — System design, monorepo structure, deployment modes
- [Data Model](architecture/data-model.md) — Complete SQLite schema and genealogical database design
- [AI Strategy](architecture/ai-strategy.md) — Claude integration, prompt design, tool definitions
