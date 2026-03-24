# SearXNG Railway Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a private SearXNG instance on Railway and wire it into the research federated search pipeline so `web_search` returns real results.

**Architecture:** A thin Dockerfile over the official SearXNG image with a custom `settings.yml` enabling JSON API format. Deployed as a new Railway service alongside the existing Hono worker. The Next.js app on Vercel calls it via `SEARXNG_URL` env var through the existing `SearXNGAdapter`.

**Tech Stack:** Docker, SearXNG, Railway CLI, Next.js API routes, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `infra/searxng/Dockerfile` | Create | Thin layer over official SearXNG image |
| `infra/searxng/settings.yml` | Create | JSON API format, limiter, engine config |
| `infra/searxng/README.md` | Create | Deploy, update, troubleshoot instructions |
| `apps/web/app/api/research/providers/health/route.ts` | Modify | Register WebSearchProvider in health check |
| `docs/architecture/decisions/012-searxng-web-search.md` | Create | ADR for SearXNG choice |

---

### Task 1: Create SearXNG Docker configuration

**Files:**
- Create: `infra/searxng/Dockerfile`
- Create: `infra/searxng/settings.yml`

> **Note:** The spec pinned `2024.12.28-cc1fed970` but this plan uses the latest available tag `2026.3.20-6c7e9c197` (March 2026). Verify it exists on Docker Hub before building: `docker pull searxng/searxng:2026.3.20-6c7e9c197`. If it fails, check https://hub.docker.com/r/searxng/searxng/tags for the latest tag and substitute.

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
FROM searxng/searxng:2026.3.20-6c7e9c197
COPY settings.yml /etc/searxng/settings.yml
```

- [ ] **Step 2: Generate a secret key**

Run: `openssl rand -hex 32`

Copy the output — you'll paste it into `settings.yml` in the next step. This is a solo-dev personal project so committing the secret is acceptable.

- [ ] **Step 3: Create settings.yml**

Replace `<PASTE_SECRET_HERE>` with the hex string from Step 2.

```yaml
use_default_settings: true

server:
  secret_key: "<PASTE_SECRET_HERE>"
  limiter: true
  image_proxy: false

search:
  formats:
    - html
    - json
  default_lang: en

# Keep reliable engines, disable noisy ones
engines:
  - name: google
    disabled: false
  - name: bing
    disabled: false
  - name: duckduckgo
    disabled: false
  - name: wikipedia
    disabled: false
  - name: wikidata
    disabled: false
  - name: internet archive
    disabled: false
```

- [ ] **Step 4: Verify Docker build locally**

Run: `docker build -t ancstra-searxng ./infra/searxng`
Expected: Builds successfully, image tagged `ancstra-searxng`.

- [ ] **Step 5: Test locally**

Run: `docker run -d -p 8080:8080 --name searxng-test ancstra-searxng`
Then: `curl "http://localhost:8080/search?q=genealogy+smith&format=json" | head -c 500`
Expected: JSON response with `results` array containing search results.

If you get HTML instead of JSON, the `search.formats` setting was not applied — double-check `settings.yml` syntax.

- [ ] **Step 6: Stop and remove test container**

Run: `docker stop searxng-test && docker rm searxng-test`

- [ ] **Step 7: Commit**

```bash
git add infra/searxng/Dockerfile infra/searxng/settings.yml
git commit -m "feat(infra): add SearXNG Docker config for Railway deployment"
```

---

### Task 2: Deploy to Railway

**Prerequisites:** Railway CLI v4.12+ installed (`railway --version`), authenticated (`railway login`), linked to the ancstra project (`railway link`).

**Important:** The Railway CLI cannot create services — create the service via the Railway dashboard first.

- [ ] **Step 1: Create the service in Railway dashboard**

1. Open your Railway project: `railway open`
2. Click "New" → "Empty Service"
3. Name it `searxng`

- [ ] **Step 2: Deploy from infra/searxng directory**

Run: `railway up --service searxng -d infra/searxng`

If the positional path argument doesn't work, try:
```bash
cd infra/searxng && railway up --service searxng --detach && cd ../..
```

Expected: Deploy starts, outputs a deployment ID.

- [ ] **Step 3: Add a public domain**

Run: `railway domain --service searxng`
Expected: Railway assigns a domain like `searxng-production-xxxx.up.railway.app`. **Note this URL — you'll need it for the next steps.**

- [ ] **Step 4: Verify the deployment**

Run: `curl "https://<domain>/search?q=test&format=json" | head -c 500`
Expected: JSON with `"results": [...]` containing search results.

**Troubleshooting if this fails:**
- 502/503: Service is still starting. Wait 30s and retry.
- HTML response: JSON format not enabled in `settings.yml`. Check `search.formats` includes `json`.
- Connection refused: Domain not yet propagated. Wait 1 minute.

- [ ] **Step 5: Set SEARXNG_URL in Vercel**

The Next.js app runs on **Vercel**, not Railway. Set the env var there:

1. Go to Vercel dashboard → ancstra project → Settings → Environment Variables
2. Add: `SEARXNG_URL` = `https://<domain>` (the Railway domain from step 3)
3. Redeploy or wait for next deploy to pick it up

Also add to `apps/web/.env.local` for local dev:
```
SEARXNG_URL=https://<domain>
```

---

### Task 3: Fix health route to register WebSearchProvider

**Files:**
- Modify: `apps/web/app/api/research/providers/health/route.ts`

The health route currently only checks if `SEARXNG_URL`/`BRAVE_API_KEY` env vars exist (lines 82-84) and sets `unknown` if missing. It never instantiates or health-checks the `WebSearchProvider`. The search route does this correctly — mirror that pattern.

- [ ] **Step 1: Add `createWebSearchProvider` to the imports**

In `apps/web/app/api/research/providers/health/route.ts`, the existing imports already include `WebSearchProvider`. Add only `createWebSearchProvider`:

```typescript
import {
  ProviderRegistry,
  MockProvider,
  NARAProvider,
  ChroniclingAmericaProvider,
  FamilySearchProvider,
  WikiTreeProvider,
  WebSearchProvider,
  createWebSearchProvider,
  type HealthStatus,
} from '@ancstra/research';
```

- [ ] **Step 2: Register WebSearchProvider in `buildRegistry()`**

Add after the WikiTreeProvider registration (line 23), before the `return registry`:

```typescript
  const webSearch = createWebSearchProvider();
  if (webSearch) {
    registry.register(webSearch);
  }
```

- [ ] **Step 3: Remove the manual `unknown` fallback**

Delete lines 82-84:

```typescript
  // DELETE these three lines:
  if (!process.env.SEARXNG_URL && !process.env.BRAVE_API_KEY) {
    results['web_search'] = 'unknown';
  }
```

The provider registry now handles `web_search` automatically — if neither env var is set, `createWebSearchProvider()` returns null and the provider is simply not registered (no key in the output, which is correct).

- [ ] **Step 4: Verify locally**

Start the dev server (with `SEARXNG_URL` in `.env.local`) and hit:

```bash
curl http://localhost:3000/api/research/providers/health | head -c 500
```

Expected: `"web_search": "healthy"` in the response.

Without `SEARXNG_URL`: `web_search` key should be absent (not `unknown`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/research/providers/health/route.ts
git commit -m "fix(research): register WebSearchProvider in health check route"
```

---

### Task 4: Write documentation

**Files:**
- Create: `infra/searxng/README.md`
- Create: `docs/architecture/decisions/012-searxng-web-search.md`

Write docs before end-to-end testing so troubleshooting guidance is available.

- [ ] **Step 1: Write infra/searxng/README.md**

Cover:
- What this is (private SearXNG instance for Ancstra's research pipeline)
- Prerequisites (Railway CLI, Docker for local testing)
- Deploy steps (create service in dashboard, `railway up`, add domain, set Vercel env var)
- Update steps (check Docker Hub for new tag, update Dockerfile, redeploy)
- Local testing (`docker build`, `docker run`, `curl` with `format=json`)
- Troubleshooting (JSON format issues, rate limiting from engines, cold starts)

- [ ] **Step 2: Write ADR 012**

Follow the existing ADR format in `docs/architecture/decisions/`. Check ADR 011 for the format. Cover:
- **Context:** research pipeline needs web search; `WebSearchProvider` exists but no backend configured
- **Decision:** self-hosted SearXNG on Railway, same project as Hono worker
- **Rationale:** free, private, aggregates multiple engines, adapter already built
- **Consequences:** adds Docker image maintenance; public endpoint needed (mitigated by limiter); Railway Hobby tier sufficient

- [ ] **Step 3: Commit**

```bash
git add infra/searxng/README.md docs/architecture/decisions/012-searxng-web-search.md
git commit -m "docs: add SearXNG deployment README and ADR 012"
```

---

### Task 5: Verify end-to-end in browser

**Prerequisites:** Dev server running with `SEARXNG_URL` set in `apps/web/.env.local`.

- [ ] **Step 1: Check provider health**

Navigate to the research page or call:
```bash
curl http://localhost:3000/api/research/providers/health | head -c 500
```
Expected: `web_search: healthy`

**If `web_search` shows `down`:**
- Check `SEARXNG_URL` is set in `.env.local` and server was restarted after adding it
- `curl` the SearXNG URL directly to confirm it responds
- Check Railway logs: `railway logs --service searxng`

- [ ] **Step 2: Test federated search**

In the research hub, search for "John Smith born 1850 Virginia".
Expected: Results from `chronicling_america` AND `web_search` providers appear.

- [ ] **Step 3: Verify web_search results quality**

Check that `web_search` results have:
- Non-empty titles
- Valid URLs (clickable)
- Snippets with genealogy-relevant content

---

### Task 6: Clean up Sentry dev workaround

**Files:**
- Restore: `apps/web/instrumentation.ts` (from `.bak`)
- Restore: `apps/web/instrumentation-client.ts` (from `.bak`)
- Restore: `apps/web/sentry.server.config.ts` (from `.bak`)
- Restore: `apps/web/sentry.edge.config.ts` (from `.bak`)
- Verify: `apps/web/next.config.ts` (dev bypass already in place)

During browser testing earlier, we disabled Sentry instrumentation to unblock Turbopack's proxy compilation hang. The `next.config.ts` already has a dev-mode bypass (`isDev` check). Restore the instrumentation files so production Sentry works.

> **Note:** This task is housekeeping from the current session, not part of the SearXNG spec.

- [ ] **Step 1: Restore Sentry files**

```bash
mv apps/web/instrumentation.ts.bak apps/web/instrumentation.ts
mv apps/web/instrumentation-client.ts.bak apps/web/instrumentation-client.ts
mv apps/web/sentry.server.config.ts.bak apps/web/sentry.server.config.ts
mv apps/web/sentry.edge.config.ts.bak apps/web/sentry.edge.config.ts
```

- [ ] **Step 2: Verify next.config.ts has the dev bypass**

Should already read:
```typescript
const isDev = process.env.NODE_ENV === 'development';

export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, { ... });
```

- [ ] **Step 3: Verify dev server starts without hanging**

Run: `cd apps/web && pnpm dev`
Expected: "Ready in Xms" without getting stuck on "Compiling proxy..."

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts apps/web/instrumentation.ts apps/web/instrumentation-client.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts
git commit -m "fix(web): bypass Sentry wrapper in dev to prevent Turbopack proxy hang"
```
