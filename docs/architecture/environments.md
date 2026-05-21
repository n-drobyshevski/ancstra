# Environments — `main` (prod) and `dev` (staging)

This is the operational runbook for our two deployed environments. Code lives in one branch tree; what differs is the **values** of environment variables and which **backing services** the deploy talks to.

## Branch model

| Branch | Vercel scope | URL | Backing services |
|--------|-------------|-----|------------------|
| `main` | Production | `https://ancstra-ndrobyshevskis-projects.vercel.app` (auto-assigned) | prod Turso central + family DBs, prod AUTH_SECRET, Sentry `environment:production` |
| `dev`  | Preview (branch=dev) | `https://ancstra-git-dev-ndrobyshevskis-projects.vercel.app` (Vercel branch alias) | **dev** Turso central + family DBs (forked from prod), **separate** AUTH_SECRET, Sentry `environment:development` |
| `feat/*` | Preview | Vercel-generated `*.vercel.app` URL per deploy | inherits Preview env vars (= dev values by default) |

**Promotion flow**

```
feat/<name>  ──(PR, squash-merge)──►  dev  ──(release PR, fast-forward)──►  main
```

- Squash-merge into `dev` keeps the integration log tidy.
- Fast-forward `dev → main` keeps `main`'s history linear and bisectable.
- Never push directly to `main` or `dev` — both have branch protection.

> **Custom domain (deferred).** We initially considered `ancstra.com` + `dev.ancstra.com` but the apex isn't currently owned. Either acquire the apex (or pick a different one) and add it under Vercel → Domains, pinning the dev subdomain to the `dev` branch — see ["Adding a custom domain later"](#adding-a-custom-domain-later) below.

## Adding a new environment variable

When you introduce a new env var, **always** set it in both scopes. The Vercel dashboard makes one easy to forget. Workflow:

```
vercel env add MY_VAR production --value "<prod-value>"
vercel env add MY_VAR preview dev --value "<dev-value>" --yes --force
```

(The `--yes --force` are needed because of a CLI non-interactive quirk; without them the v50 CLI prompts to disambiguate "all preview branches" vs a specific branch.)

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
| `NEXT_PUBLIC_APP_URL` | `https://ancstra-ndrobyshevskis-projects.vercel.app` | `https://ancstra-git-dev-ndrobyshevskis-projects.vercel.app` |
| `AUTH_URL` | (prod URL — not yet set, NextAuth falls back to `AUTH_TRUST_HOST` resolution) | `https://ancstra-git-dev-ndrobyshevskis-projects.vercel.app` |
| `CENTRAL_DATABASE_URL` | prod libsql URL | `libsql://ancstra-central-dev-<org>.aws-eu-west-1.turso.io` |
| `TURSO_AUTH_TOKEN` | prod token | dev-scoped token |
| `AUTH_SECRET` | prod secret | independent random secret |
| `ANTHROPIC_API_KEY` | (not yet set in prod) | (not yet set in dev — provision when first AI feature ships) |
| `AI_MONTHLY_BUDGET_USD` | (not yet set) | `5` |
| `SENTRY_ENVIRONMENT` | `production` | `development` |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` | `development` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | `1.0` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.1` | `1.0` |

Shared across both (Production has them; dev got copies of the same values via the env-bootstrap script): `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `TURSO_ORG`, `TURSO_PLATFORM_TOKEN`, `HONO_WORKER_URL`, `GOTENBERG_URL`, `SEARXNG_URL`, `ENABLE_EXPERIMENTAL_COREPACK`, `AUTH_TRUST_HOST=true`. `SENTRY_AUTH_TOKEN` is intentionally empty in Production (source-map upload disabled).

## Turso provisioning (initial dev setup)

Single org `n-drobyshevski`, AWS EU West 1.

### Recommended: run the fork script

`apps/web/scripts/fork-prod-to-dev.ts` does everything via the official
`@tursodatabase/api` SDK (HTTP Platform API) — **no `turso` CLI required**.
It walks `family_registry`, forks every active family DB with a `-dev`
suffix, mints a long-lived dev token, polls until the new central is
queryable, and rewrites `family_registry.dbFilename` to point at the
`-dev` URLs. Idempotent — safe to re-run; already-forked DBs are skipped.

```
# Required in apps/web/.env.local:
#   CENTRAL_DATABASE_URL  prod libsql URL
#   TURSO_AUTH_TOKEN      libsql client token for prod (read is enough)
#   TURSO_ORG             org slug, e.g. n-drobyshevski
#   TURSO_PLATFORM_TOKEN  Platform API token (database:create + tokens:create)

# Dry-run first to see what would happen:
pnpm --filter web exec tsx scripts/fork-prod-to-dev.ts --dry-run

# Execute:
pnpm --filter web exec tsx scripts/fork-prod-to-dev.ts
```

The script prints the dev `CENTRAL_DATABASE_URL` and `TURSO_AUTH_TOKEN`
at the end — paste those into Vercel (Preview scope, branch=dev).

### Manual fallback (Turso web dashboard)

If you'd rather click through the dashboard, the operations are:

1. Databases → New database → seed from `ancstra-central` → name
   `ancstra-central-dev`.
2. For each row in prod's `family_registry`, repeat: new database, seed
   from `<family-name>`, name `<family-name>-dev`.
3. Generate a token for `ancstra-central-dev` (never expires, full access).
4. Open the dashboard SQL shell against `ancstra-central-dev` and run, for
   each family forked:
   ```sql
   UPDATE family_registry
   SET dbFilename = REPLACE(dbFilename, '<prod-host>', '<prod-host-with-dev-suffix>')
   WHERE id = '<family-id>';
   ```

### Turso CLI (optional, not required)

The `turso` CLI is not installed by default on Windows (it ships only via
WSL). The fork script above intentionally uses the HTTP Platform API so
this isn't a blocker. If you do want it for ad-hoc commands like
`turso db shell`, install via WSL Ubuntu:

```
wsl --install Ubuntu   # one-time
# inside Ubuntu shell:
curl -sSfL https://get.tur.so/install.sh | bash
```

### Migration drift between prod and dev central

Forking copies the schema as it exists *at the moment* of the fork. The runtime `ensureCentralSchema()` in `packages/db/src/index.ts` only ADDs columns/tables — it cannot replay DROP, RENAME, or type-changing migrations. Any future destructive Drizzle migration **must** be applied to both DBs:

```
# Apply against prod
CENTRAL_DATABASE_URL=libsql://ancstra-central-... TURSO_AUTH_TOKEN=... pnpm --filter db drizzle-kit migrate

# Apply against dev
CENTRAL_DATABASE_URL=libsql://ancstra-central-dev-... TURSO_AUTH_TOKEN=... pnpm --filter db drizzle-kit migrate
```

When in doubt, run a `drizzle-kit check` against both and compare output.

## OAuth provider configuration

Not currently wired (no `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, or `FAMILYSEARCH_CLIENT_ID` in either env). When you do add OAuth:

### Google

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.

- **Authorized redirect URIs** (add one per environment):
  - `https://<prod-url>/api/auth/callback/google`
  - `https://ancstra-git-dev-ndrobyshevskis-projects.vercel.app/api/auth/callback/google`
- **Authorized JavaScript origins** (add the corresponding apex origins).

Vercel preview URLs are accepted by Google as redirect URIs — no custom domain required.

### Apple

**Blocked until a custom apex domain is wired.** Apple Sign In requires domain verification (a file at `https://<apex>/.well-known/apple-developer-domain-association`) and Vercel's `*.vercel.app` hosts can't be verified because we don't own them. Acquire a custom domain first, then follow Apple Developer → Identifiers → Services IDs.

### FamilySearch

Check whether the existing OAuth app accepts multiple redirect URIs. If not, register a separate sandbox app for dev. `FAMILYSEARCH_REDIRECT_URI` is already designed to be per-env.

## Cookie domain — important

Never set a `Domain=` attribute on a session, CSRF, or auth cookie. Without `Domain=`, browsers treat cookies as **host-only**, so prod and dev URLs (even when they're sibling vercel.app subdomains under `*.vercel.app`) get separate cookie jars. Setting `Domain=.vercel.app` would let any project on the platform see them — never do that. Same applies if you later move to a custom domain: `Domain=.your-domain.com` would cross-pollinate prod and dev.

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
- **Rotate dev TURSO_AUTH_TOKEN**: call `turso.databases.rotateTokens('ancstra-central-dev')` via the SDK or hit the Platform API → update Preview-dev → redeploy.
- **Rebuild dev central from scratch**: delete `ancstra-central-dev` + each `-dev` family DB, re-run `fork-prod-to-dev.ts`.
- **Reset dev to current prod state**: same as rebuild — fork is destructive but cheap.

## Robots / SEO

`apps/web/app/robots.ts` returns `Disallow: /` when `SENTRY_ENVIRONMENT === 'development'`. Verify after a dev deploy:

```
curl https://ancstra-git-dev-ndrobyshevskis-projects.vercel.app/robots.txt
```

Should be `User-agent: *\nDisallow: /`.

## Adding a custom domain later

Plan when you acquire an apex (say, `ancstra.com`):

1. In Vercel → Project → Settings → Domains:
   - Add the apex + `www` → assign to Production.
   - Add `dev.<apex>` → assign to Preview, scoped to git branch `dev`.
2. At your DNS provider: A record for apex to Vercel's address (Vercel displays it), CNAMEs for `www` and `dev` to `cname.vercel-dns.com`.
3. Update the Preview/dev env vars: `NEXT_PUBLIC_APP_URL=https://dev.<apex>`, `AUTH_URL=https://dev.<apex>`, `NEXTAUTH_URL=https://dev.<apex>`.
4. Update the Production env vars similarly to `https://<apex>`.
5. Unblock Apple Sign In (host the domain-association file at `apps/web/public/.well-known/apple-developer-domain-association`).
6. Add `NEXT_PUBLIC_DOCS_URL=https://docs.<apex>` if you stand up a docs subdomain.

