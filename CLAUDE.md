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
- **Commit style is conventional-commits** (already in use). Bump rules
  (pre-1.0 — set by `bump-minor-pre-major: true` + `bump-patch-for-minor-pre-major: true`):
  - `feat:` → patch (becomes minor once we cut 1.0.0)
  - `fix:` / `perf:` / `refactor:` → patch
  - `BREAKING CHANGE:` footer or `feat!:` → minor (becomes major once we cut 1.0.0)
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
- **Tagging invariant on `main`**: every commit on `main` MUST be reachable from
  a `v*` tag. release-please-action creates these automatically when its release
  PR merges. After any merge to `main`, verify:
  ```bash
  git fetch origin main --tags
  git tag --contains origin/main || echo "MISSING TAG on $(git rev-parse --short origin/main)"
  ```
  If missing → re-trigger release-please from the Actions tab, OR create
  manually: `gh release create vX.Y.Z --target main --generate-notes`.
  Never let `main` accrete untagged commits — a single non-release PR landing
  on `main` violates this; if it happens, open the next release PR immediately.
- **dev → main merges MUST use "merge commit" or "rebase", NOT "squash".**
  release-please parses individual conventional-commit messages on `main` to
  compute bumps; squashing collapses them into one non-conventional message
  (`release: prepare vX.Y.Z (#N)`) which release-please skips, producing no
  release PR. Feature → dev squashing remains fine (release-please doesn't
  watch dev). Until main's branch ruleset is updated to forbid squash, the
  discipline is on you/Claude — pick "Create a merge commit" in the PR UI.
- **The running version is exposed at**:
  - `/api/health` (JSON: `{ version, commit, builtAt, env }`)
  - Sidebar footer (`AppVersionBadge` component)
  - Sentry `release` tag (set in all three Sentry init files)
- **Going to `1.0.0`**: when ready, push an empty commit with body
  `Release-As: 1.0.0` on `dev` so the next release-please PR bumps to 1.0.0
  regardless of conventional-commit rules.
- **Baseline tag**: `v0.1.0` on `main` at SHA `79b3c75`, established 2026-05-21
  alongside release-please adoption (https://github.com/n-drobyshevski/ancstra/releases/tag/v0.1.0).
  All subsequent `vX.Y.Z` tags created by release-please.
