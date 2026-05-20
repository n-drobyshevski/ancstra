# Environments — `main` (prod) and `dev` (staging)

This is the operational runbook for our two deployed environments. Code lives in one branch tree; what differs is the **values** of environment variables and which **backing services** the deploy talks to.

## Branch model

| Branch | Vercel scope | Domain | Backing services |
|--------|-------------|--------|------------------|
| `main` | Production | `ancstra.com`, `www.ancstra.com` | prod Turso central + family DBs, prod AUTH_SECRET, prod Anthropic key, Sentry `environment:production` |
| `dev`  | Preview (branch=dev) | `dev.ancstra.com` | **dev** Turso central + family DBs (forked from prod), **separate** AUTH_SECRET, **separate** Anthropic key, Sentry `environment:development` |
| `feat/*` | Preview | Vercel-generated `*.vercel.app` | inherits Preview env vars (= dev values by default) |

**Promotion flow**

```
feat/<name>  ──(PR, squash-merge)──►  dev  ──(release PR, fast-forward)──►  main
```

- Squash-merge into `dev` keeps the integration log tidy.
- Fast-forward `dev → main` keeps `main`'s history linear and bisectable.
- Never push directly to `main` or `dev` — both have branch protection.

## Adding a new environment variable

When you introduce a new env var, **always** set it in both scopes. The Vercel dashboard makes one easy to forget. Workflow:

```
vercel env add MY_VAR production
vercel env add MY_VAR preview dev          # branch-scoped to dev
vercel env add MY_VAR preview              # generic preview (used by other branches)
```

Then add it to:

1. `.env.example` — with a comment if the value differs per env
2. `turbo.json` → `tasks.build.env` if the build hashes on it
3. This doc's matrix below if it's per-env

Quarterly sanity check:

```
vercel env ls production  > /tmp/prod-vars
vercel env ls preview dev > /tmp/dev-vars
diff <(awk '{print $1}' /tmp/prod-vars) <(awk '{print $1}' /tmp/dev-vars)
```

## Per-environment value matrix

Values listed differ between scopes. Anything not listed here is identical.

| Variable | Production | Preview (dev) |
|----------|-----------|---------------|
| `NEXT_PUBLIC_APP_URL` | `https://ancstra.com` | `https://dev.ancstra.com` |
| `AUTH_URL` | `https://ancstra.com` | `https://dev.ancstra.com` |
| `CENTRAL_DATABASE_URL` | prod libsql URL | dev libsql URL |
| `TURSO_AUTH_TOKEN` | prod token | dev-scoped token |
| `AUTH_SECRET` | prod secret | independent random secret |
| `ANTHROPIC_API_KEY` | prod key | independent dev key |
| `AI_MONTHLY_BUDGET_USD` | prod budget | lower (~`5`) |
| `FAMILYSEARCH_REDIRECT_URI` | `https://ancstra.com/api/auth/familysearch/callback` | `https://dev.ancstra.com/api/auth/familysearch/callback` |
| `SENTRY_ENVIRONMENT` | `production` | `development` |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` | `development` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | `1.0` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.1` | `1.0` |

Shared across both: `GOOGLE_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID/SECRET`, `FAMILYSEARCH_CLIENT_ID/SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NARA_API_KEY`, `AUTH_TRUST_HOST=true`.

## Turso provisioning (initial dev setup)

Single org `n-drobyshevski`, AWS EU West 1.

```
# Fork central
turso db create ancstra-central-dev --from-db ancstra-central
turso db tokens create ancstra-central-dev --expiration none

# Fork each family DB (look up the list first)
turso db shell ancstra-central "SELECT id, dbFilename FROM family_registry WHERE deletedAt IS NULL"
# Then for each row:
turso db create <family-name>-dev --from-db <family-name>
turso db tokens create <family-name>-dev --expiration none

# Rewrite registry on the dev central so it points at the forked URLs
turso db shell ancstra-central-dev "UPDATE family_registry SET dbFilename = REPLACE(dbFilename, '<prod-host>', '<prod-host-with-dev-suffix>')"
```

For a hands-off run, use `apps/web/scripts/fork-prod-to-dev.ts` — it walks the registry, mints `-dev` forks, and rewrites the URLs idempotently.

### Migration drift between prod and dev central

Forking copies the schema as it exists *at the moment* of `turso db create --from-db`. The runtime `ensureCentralSchema()` in `packages/db/src/index.ts` only ADDs columns/tables — it cannot replay DROP, RENAME, or type-changing migrations. Any future destructive Drizzle migration **must** be applied to both DBs:

```
# Apply against prod
CENTRAL_DATABASE_URL=libsql://ancstra-central-... TURSO_AUTH_TOKEN=... pnpm --filter db drizzle-kit migrate

# Apply against dev
CENTRAL_DATABASE_URL=libsql://ancstra-central-dev-... TURSO_AUTH_TOKEN=... pnpm --filter db drizzle-kit migrate
```

When in doubt, run a `drizzle-kit check` against both and compare output.

## OAuth provider configuration

Single OAuth client per provider, multiple redirect URIs.

### Google

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.

- **Authorized redirect URIs** (add both):
  - `https://ancstra.com/api/auth/callback/google`
  - `https://dev.ancstra.com/api/auth/callback/google`
- **Authorized JavaScript origins** (add both):
  - `https://ancstra.com`
  - `https://dev.ancstra.com`

### Apple

Apple Developer → Identifiers → Services IDs → your Service ID.

- **Domains and Subdomains**: add `dev.ancstra.com`.
- **Return URLs**: add `https://dev.ancstra.com/api/auth/callback/apple`.
- **Domain verification**: download the domain association file from Apple and place it at `apps/web/public/.well-known/apple-developer-domain-association`. Apple's verifier will fetch it from both origins. If Apple gives you a per-origin file, host the dev one only on the dev deploy (Vercel doesn't let one branch override `public/` paths; use a tiny `apps/web/app/.well-known/route.ts` handler if needed).

### FamilySearch

Check whether your existing FamilySearch OAuth app accepts multiple redirect URIs. If not, register a separate sandbox app for dev and put those credentials in the Preview-dev scope only. `FAMILYSEARCH_REDIRECT_URI` is already per-env.

## Cookie domain — important

Never set `Domain=.ancstra.com` (or any apex `Domain=` attribute) on a session, CSRF, or auth cookie. With apex scope, a session set on `dev.ancstra.com` would be sent to `ancstra.com` and vice versa, completely defeating the isolation.

The codebase today does not set `Domain=` on any cookie — they're host-only by default. Keep it that way. A grep before merge:

```
git grep -nE "cookies?\.(set|getSet).+Domain" apps packages
```

## Sentry filtering

Once events flow, filter by environment in the Sentry UI:

- Production: https://sentry.io/organizations/<org>/issues/?environment=production
- Dev:        https://sentry.io/organizations/<org>/issues/?environment=development

You can save these as named views in the Sentry sidebar.

## Disaster recovery

- **Rotate dev AUTH_SECRET**: `openssl rand -base64 32` → update Preview-dev scope → redeploy. No effect on prod.
- **Rotate dev Anthropic key**: revoke + reissue in Anthropic console → update Preview-dev → redeploy. Prod unaffected.
- **Rebuild dev central from scratch**: delete `ancstra-central-dev` + each `-dev` family DB, re-run `fork-prod-to-dev.ts`.
- **Reset dev to current prod state**: same as rebuild — fork is destructive but cheap.

## Robots / SEO

`apps/web/app/robots.ts` returns `Disallow: /` when `SENTRY_ENVIRONMENT === 'development'`. Verify after a dev deploy:

```
curl https://dev.ancstra.com/robots.txt
```

Should be `User-agent: *\nDisallow: /`.
