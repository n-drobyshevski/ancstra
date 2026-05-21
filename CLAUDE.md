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

## Branch & Release Workflow

- **All day-to-day work happens on `dev`.** Never commit to `main` directly —
  it's branch-protected and only accepts release PRs.
- `dev` auto-deploys to `dev.ancstra.com` (staging). `main` auto-deploys to
  `ancstra.com` (production).
- The canonical prod version lives in root `package.json` (`version` field) and
  is propagated to `apps/web/package.json` automatically by release-please's
  `node-workspace` plugin. Internal `@ancstra/*` packages stay at `0.0.1` —
  they're private and don't ship.
- **Commit style is conventional-commits** (already in use). Bump rules:
  - `feat:` → minor
  - `fix:` / `perf:` / `refactor:` → patch
  - `BREAKING CHANGE:` footer or `feat!:` → major (but while `< 1.0.0`,
    `bump-minor-pre-major: true` keeps these as minor — standard 0.x semantic)
  - `chore:` / `docs:` / `test:` / `ci:` / `build:` / `style:` → no release
- **To check if a release is warranted**, run from `dev`:
  ```bash
  git fetch --tags
  git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..dev --oneline
  ```
  Apply the bump rules above. If only `chore/docs/test/ci/build/style` commits
  exist → no release; report back.
- **To cut a release**: open PR `dev → main` titled `release: prepare vX.Y.Z`
  (no version bump in this PR — it's just the merge of dev's work into main).
  After merge, `release-please-action` on `main` opens its own PR titled
  `chore(main): release X.Y.Z` with the actual `package.json` bumps + CHANGELOG
  entries. Merging that PR creates the `vX.Y.Z` tag + GitHub Release and
  triggers the Vercel production deploy.
- **Release config**: `release-please-config.json` + `.release-please-manifest.json`
  at repo root. Workflow: `.github/workflows/release-please.yml`.
- **The running version is exposed at**:
  - `/api/health` (JSON: `{ version, commit, builtAt, env }`)
  - Sidebar footer (`AppVersionBadge` component)
  - Sentry `release` tag (set in all three Sentry init files)
- **Going to `1.0.0`**: when ready, push an empty commit with body
  `Release-As: 1.0.0` on `dev` so the next release-please PR bumps to 1.0.0
  regardless of conventional-commit rules.
