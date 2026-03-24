# SearXNG — Private Search Instance for Ancstra

A self-hosted [SearXNG](https://docs.searxng.org/) instance deployed on Railway. It acts as the backend for `WebSearchProvider` in the Ancstra research pipeline, aggregating results from Google, Bing, DuckDuckGo, Wikipedia, Wikidata, and Internet Archive without leaking queries to any single commercial provider.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Extends the official SearXNG image and bakes in `settings.yml` |
| `settings.yml` | Engine list, JSON format, limiter config |

## Prerequisites

- [Railway CLI](https://docs.railway.app/guides/cli) v4.12+
  `npm i -g @railway/cli` then `railway login`
- Docker (only needed for local testing)
- Access to the `ancstra` Railway project (`railway link`)

## Deploy to Railway

Run from the **project root** (not from `infra/searxng/`) — the Dockerfile uses a `COPY` path relative to the build context:

```bash
railway up -s searxng --detach
```

### Required Railway variable

The service needs `RAILWAY_DOCKERFILE_PATH` set so Railway knows which Dockerfile to use:

| Variable | Value |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `infra/searxng/Dockerfile` |

Set it once via the Railway dashboard (Variables tab on the `searxng` service) or:

```bash
railway variables set RAILWAY_DOCKERFILE_PATH=infra/searxng/Dockerfile -s searxng
```

### Add a public domain

```bash
railway domain -s searxng
```

This generates a `*.up.railway.app` subdomain. The current domain is `searxng-production-3acc.up.railway.app`.

### Wire up the Vercel app

`SEARXNG_URL` must be set in **Vercel project settings** (not in Railway — the Next.js app runs on Vercel, not on the same Railway service):

```
SEARXNG_URL=https://searxng-production-3acc.up.railway.app
```

Also add it to `.env.local` for local development:

```bash
SEARXNG_URL=https://searxng-production-3acc.up.railway.app
```

## Update the SearXNG version

1. Change the image tag in `infra/searxng/Dockerfile`:
   ```dockerfile
   FROM searxng/searxng:2026.X.Y-<commit>
   ```
2. Redeploy:
   ```bash
   railway up -s searxng --detach
   ```

## Local testing

Build and run from the **project root**:

```bash
docker build -t ancstra-searxng -f infra/searxng/Dockerfile .
docker run -p 8080:8080 ancstra-searxng
```

Verify JSON output:

```bash
curl "localhost:8080/search?q=test&format=json"
```

You should receive a JSON object with a `results` array. If you get HTML instead, see Troubleshooting below.

## Troubleshooting

**Getting HTML instead of JSON**
`format=json` is only served when `json` is listed under `search.formats` in `settings.yml`. Confirm the file contains:
```yaml
search:
  formats:
    - html
    - json
```
Then rebuild and redeploy.

**Rate limiting / empty results from engines**
SearXNG rotates between Google, Bing, DuckDuckGo, Wikipedia, Wikidata, and Internet Archive. Individual engines may throttle requests if the Railway IP is flagged. If results are consistently empty for one engine, mark it `disabled: true` in `settings.yml` and redeploy.

**Cold starts**
Railway Hobby tier containers spin down after inactivity. The first request after a cold start may time out. The research pipeline should treat a timeout as a retryable error. Railway does not offer always-on for free; upgrading to a paid plan enables persistent containers.
