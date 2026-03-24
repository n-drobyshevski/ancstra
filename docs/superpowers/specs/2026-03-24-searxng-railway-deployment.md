# SearXNG Railway Deployment — Design Spec

## Problem

The research federated search pipeline has a `WebSearchProvider` with adapters for SearXNG and Brave Search, but neither is configured. The provider health check returns `unknown` for `web_search`. Without a web search backend, the research hub only returns results from Chronicling America (and NARA when an API key is present).

Additionally, the health route (`apps/web/app/api/research/providers/health/route.ts`) does not register or health-check the `WebSearchProvider` — it only checks if env vars are missing and sets `unknown`. Even when `SEARXNG_URL` is configured, the health check never actually pings the instance.

## Decision

Deploy SearXNG as a service on Railway in the same project as the existing Hono worker. Use a version-controlled Dockerfile + `settings.yml` in `infra/searxng/` to keep configuration reproducible.

### Why SearXNG over Brave Search

- Free, no API key management or quota limits
- Privacy-preserving (no queries sent to third-party APIs)
- Fits Ancstra's local-first philosophy
- Already have a `SearXNGAdapter` built and tested
- Aggregates multiple search engines for broader genealogy coverage

### Why Railway

- Hono worker already deployed there — single infrastructure surface
- Official SearXNG templates and community support exist
- Hobby tier ($5/mo shared) is sufficient for a stateless metasearch engine (~512MB RAM)
- Simple Docker image deployment with auto-TLS

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Railway Project (ancstra)                       │
│                                                  │
│  ┌─────────────┐     ┌─────────────────────────┐│
│  │ Hono Worker  │     │ SearXNG                 ││
│  │ (scrape jobs)│     │ (searxng/searxng:2024.12││
│  │ port 3001    │     │  .28-cc1fed970)         ││
│  └─────────────┘     │ port 8080               ││
│                      └─────────────────────────┘│
└──────────────────────────────────────────────────┘
         ↑                        ↑
         │                        │
    WORKER_URL              SEARXNG_URL
         │                        │
┌────────┴────────────────────────┴────────────────┐
│  Vercel (Next.js web app)                        │
│  apps/web                                        │
│  createWebSearchProvider() → SearXNGAdapter      │
└──────────────────────────────────────────────────┘
```

## File Structure

```
infra/searxng/
├── Dockerfile       # Thin layer over official image, pinned version
├── settings.yml     # JSON API enabled, engine curation, limiter on
└── README.md        # Deploy and update instructions
```

## Implementation Details

### Dockerfile

```dockerfile
FROM searxng/searxng:2024.12.28-cc1fed970
COPY settings.yml /etc/searxng/settings.yml
```

Pinned to a specific release to prevent breaking changes on rebuild. To update, check https://hub.docker.com/r/searxng/searxng/tags and update the tag.

### settings.yml

Key configuration:
- `use_default_settings: true` — inherit sane defaults
- `server.secret_key` — generated at build time, baked into settings.yml (SearXNG's official entrypoint replaces a placeholder, but since we COPY our own settings.yml it may overwrite the entrypoint's substitution; safest to set it directly)
- `server.limiter: true` — **enabled** since the URL is publicly accessible (Vercel needs external access). Prevents abuse if the URL is discovered.
- `search.formats: [html, json]` — **critical**: enables JSON API that `SearXNGAdapter` depends on (`/search?format=json`)
- Engine curation: enable Google, Bing, DuckDuckGo, Wikipedia, Wikidata; disable noisy/unreliable engines

Example settings.yml structure:
```yaml
use_default_settings: true

server:
  secret_key: "<generated-hex-string>"
  limiter: true

search:
  formats:
    - html
    - json
```

### Railway Service Configuration

- **Service name:** `searxng`
- **Source:** `infra/searxng/` directory (Dockerfile deploy)
- **Port:** 8080 (SearXNG default)
- **Public domain:** auto-assigned by Railway (required — Vercel calls from outside Railway's network)
- **Health check:** GET `/` returns 200
- **Resources:** ~512MB RAM, 1 vCPU (sufficient for low-volume personal use)

### Security

The SearXNG instance must be publicly accessible because Vercel (the Next.js host) is outside Railway's private network. Mitigations:

- `server.limiter: true` — rate-limits requests to prevent abuse
- Low discoverability — auto-generated Railway subdomain, not indexed
- If abuse is detected, can add a reverse proxy with a shared secret header check (future improvement)

### Env Var Wiring

After deploy, set in **Vercel project settings** (not Railway — the web app runs on Vercel):
```
SEARXNG_URL=https://<searxng-service>.up.railway.app
```

For local dev (optional):
```
# apps/web/.env.local
SEARXNG_URL=http://localhost:8080  # if running SearXNG in Docker locally
```

### Health Route Fix

The health route at `apps/web/app/api/research/providers/health/route.ts` currently does not register `WebSearchProvider`. After wiring `SEARXNG_URL`, the health check at lines 82-84 sets `unknown` but never actually pings the instance. Fix: call `createWebSearchProvider()` in `buildRegistry()` (same as the search route does) so the provider's `healthCheck()` method is invoked.

### Railway CLI Deploy Steps

```bash
# Link to existing Railway project
railway link

# Create new service
railway service create searxng

# Deploy from infra/searxng directory
railway up --service searxng -d infra/searxng

# Add a public domain
railway domain --service searxng

# Verify
curl https://<domain>/search?q=test&format=json | head -c 200
```

Note: `SEARXNG_URL` must be added in **Vercel's environment variables UI**, not via Railway CLI, since the Next.js app runs on Vercel.

### Image Updates

To update SearXNG:
1. Check latest tag at https://hub.docker.com/r/searxng/searxng/tags
2. Update tag in `infra/searxng/Dockerfile`
3. Commit and `railway up --service searxng -d infra/searxng`

## Documentation Deliverables

1. **`infra/searxng/README.md`** — deploy, update, and troubleshoot instructions
2. **ADR `012-searxng-web-search.md`** — architectural decision record

## Verification

After deployment:
1. `curl https://<domain>/search?q=test&format=json` returns JSON with search results
2. Provider health endpoint shows `web_search: healthy` (after health route fix)
3. Research hub search returns results tagged `web_search` alongside other providers

## Risks

- **Search engine rate limiting:** SearXNG aggregates external engines (Google, Bing) which may rate-limit the Railway IP. Mitigated by engine diversity, limiter enabled, and low query volume for a solo-dev genealogy app.
- **Railway cold starts:** SearXNG may take a few seconds on first request after idle. Acceptable for a research tool.
- **Public endpoint exposure:** The URL is publicly accessible since Vercel needs external access. Mitigated by rate limiter and low discoverability (auto-generated Railway subdomain).
