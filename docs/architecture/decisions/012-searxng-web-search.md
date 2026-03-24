# ADR 012: Self-Hosted SearXNG for Research Web Search

## Status
**Accepted** — 2026-03-24

## Context
The Ancstra research pipeline includes a `WebSearchProvider` adapter that can issue live web queries to supplement genealogy source searches. The adapter was built but had no backend: it required an HTTP endpoint that accepts `GET /search?q=...&format=json` and returns aggregated web results.

Options considered:

| Option | Cost | Privacy | Complexity |
|---|---|---|---|
| Google Custom Search JSON API | $5/1 000 queries | Queries logged by Google | Low |
| Bing Web Search API | $3–$7/1 000 queries | Queries logged by Microsoft | Low |
| SerpAPI / similar proxy | $50+/mo | Third-party retention | Low |
| Self-hosted SearXNG | Free (infra cost only) | No third-party logging | Medium |

The project already had a Railway deployment (Hono worker service) inside the `ancstra` project, so adding a second Railway service incurred no new account overhead.

## Decision
Deploy a private SearXNG instance on Railway as a second service (`searxng`) within the existing `ancstra` Railway project. The instance is configured with:

- Engines: Google, Bing, DuckDuckGo, Wikipedia, Wikidata, Internet Archive
- JSON format enabled (`search.formats: [html, json]`)
- Rate limiter on (`server.limiter: true`)
- Custom `settings.yml` baked into the Docker image at build time

The `WebSearchProvider` in the Next.js app calls `SEARXNG_URL/search?q=...&format=json`. The URL is stored as a Vercel environment variable (`SEARXNG_URL`) and in `.env.local` for local development.

## Rationale

**Free and private.** SearXNG is open-source and aggregates engine results without forwarding user queries to any single provider under a named API key.

**Adapter already exists.** `WebSearchProvider` was written against a generic JSON search contract. SearXNG's `/search?format=json` response matches that contract exactly — no adapter changes were needed.

**Fits local-first philosophy.** Users running Ancstra locally can point `SEARXNG_URL` at a local SearXNG container (`docker run -p 8080:8080`) and never send queries to a remote server at all.

**Consistent deployment surface.** The Hono worker already established the pattern of Railway services for non-Vercel compute. Adding SearXNG there keeps all backend services in one Railway project.

**Railway Hobby tier is sufficient.** SearXNG has a low memory footprint. The research pipeline tolerates cold-start latency (the container may spin down after inactivity on the Hobby tier).

## Consequences

**Positive**
- No per-query cost for web search in the research pipeline
- Engine diversity (6 sources) improves result coverage for genealogy queries
- Zero changes to `WebSearchProvider` — the adapter consumed the ADR-compliant endpoint immediately

**Negative / risks**
- Adds a Docker image to maintain: the `FROM searxng/searxng:<tag>` pin in `infra/searxng/Dockerfile` must be updated when upstream releases security fixes
- The endpoint is publicly reachable (no auth). Mitigated by `server.limiter: true` in `settings.yml`, which rate-limits requests per IP
- Individual search engines (Google, Bing) may throttle or block Railway egress IPs over time, degrading result quality for those engines. Mitigation: disable affected engines in `settings.yml` and redeploy
- Cold starts on Railway Hobby tier can cause the first research query after inactivity to time out. The pipeline must treat this as a retryable error

## References
- Deployment guide: `infra/searxng/README.md`
- SearXNG docs: https://docs.searxng.org/
- Related: ADR 010 (web mode transition), ADR 001 (JS-over-Python — no Python sidecar)
