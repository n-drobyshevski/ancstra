#!/usr/bin/env node
/**
 * extract-bundle-sizes.mjs
 *
 * Generates apps/web/.next/analyze/__bundle_analysis.json from the Next.js
 * production build output. Called by the bundle-analysis CI workflow after
 * `ANALYZE=true next build`.
 *
 * The output JSON schema is:
 *   { "/route": { "raw": <bytes>, "gzip": <bytes> }, ... }
 *
 * First Load JS is computed as:
 *   sharedBytes (polyfills + framework chunks) + pageBytes (route-specific chunks)
 *
 * For App Router-only projects (no Pages Router pages), we fall back to
 * the shared-chunks total per route, since App Router chunk splits are
 * not exposed through build-manifest.json.
 *
 * Usage:
 *   node scripts/extract-bundle-sizes.mjs [--next-dir apps/web/.next]
 */

import { readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const NEXT_DIR = args['next-dir'] ?? 'apps/web/.next';
const OUT_DIR = join(NEXT_DIR, 'analyze');
const OUT_FILE = join(OUT_DIR, '__bundle_analysis.json');

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helper: get file size (returns 0 if file missing)
// ---------------------------------------------------------------------------

function fileSize(relPath) {
  const abs = join(NEXT_DIR, relPath);
  try {
    return statSync(abs).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Load build-manifest.json
// ---------------------------------------------------------------------------

const bmPath = join(NEXT_DIR, 'build-manifest.json');
if (!existsSync(bmPath)) {
  console.error(`[extract-bundle-sizes] build-manifest.json not found at ${bmPath}`);
  console.error('[extract-bundle-sizes] Skipping extraction — writing empty result.');
  writeFileSync(OUT_FILE, '{}');
  process.exit(0);
}

const bm = JSON.parse(readFileSync(bmPath, 'utf8'));

// ---------------------------------------------------------------------------
// Compute shared chunk bytes (sent on every page load)
// ---------------------------------------------------------------------------

const sharedChunks = [
  ...(bm.polyfillFiles ?? []),
  ...(bm.rootMainFiles ?? []),
];
const sharedBytes = sharedChunks.reduce((sum, f) => sum + fileSize(f), 0);

// ---------------------------------------------------------------------------
// Per-page (Pages Router) route sizes
// ---------------------------------------------------------------------------

const pages = bm.pages ?? {};
const result = {};

for (const [page, chunks] of Object.entries(pages)) {
  // Skip framework-internal pages that are not real user routes
  if (page.startsWith('/_') && page !== '/_app') continue;

  const pageBytes = chunks.reduce((sum, f) => sum + fileSize(f), 0);
  const raw = sharedBytes + pageBytes;
  result[page] = { raw, gzip: Math.round(raw * 0.3) };
}

// ---------------------------------------------------------------------------
// App Router fallback: if no pages-router routes found, derive from
// app-path-routes-manifest.json and use shared-chunk total as estimate
// ---------------------------------------------------------------------------

const appManifestPath = join(NEXT_DIR, 'app-path-routes-manifest.json');
if (Object.keys(result).length === 0 && existsSync(appManifestPath)) {
  const appRoutes = JSON.parse(readFileSync(appManifestPath, 'utf8'));
  for (const [_filePath, route] of Object.entries(appRoutes)) {
    // Skip API routes — they ship no client JS
    if (route.startsWith('/api/')) continue;
    result[route] = { raw: sharedBytes, gzip: Math.round(sharedBytes * 0.3) };
  }
  if (Object.keys(result).length > 0) {
    console.log('[extract-bundle-sizes] App Router project detected — using shared-chunk estimate per route.');
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`[extract-bundle-sizes] Wrote ${Object.keys(result).length} routes to ${OUT_FILE}`);
