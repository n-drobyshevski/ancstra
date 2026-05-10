#!/usr/bin/env node
/**
 * bundle-report.mjs
 *
 * Reads two __bundle_analysis.json files (current build + main baseline)
 * and emits a Markdown delta table of per-route First Load JS sizes.
 *
 * Schema of __bundle_analysis.json
 * ---------------------------------
 * This file is produced by the `extract-bundle-sizes` step in
 * .github/workflows/bundle-analysis.yml, which reads the Next.js build
 * output (.next/) and computes per-route sizes:
 *
 *   {
 *     "/":           { "raw": 85000,  "gzip": 24000  },
 *     "/dashboard":  { "raw": 125000, "gzip": 38000  },
 *     "/persons/[id]": { "raw": 98000, "gzip": 29000 }
 *   }
 *
 * Fields:
 *   raw   — uncompressed First Load JS bytes (all shared chunks + page chunk)
 *   gzip  — gzip-compressed estimate (≈ raw * 0.30 for JS)
 *
 * Usage
 * -----
 *   node scripts/bundle-report.mjs \
 *     --current  apps/web/.next/analyze/__bundle_analysis.json \
 *     --baseline /tmp/bundle-baseline/__bundle_analysis.json \
 *     --output   bundle-report.md
 *
 * Exits 0 in all cases (soft-warn — no CI hard-fail).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

const currentPath = args['current'];
const baselinePath = args['baseline'];
const outputPath = args['output'];

if (!currentPath || !outputPath) {
  console.error('Usage: bundle-report.mjs --current <path> --baseline <path> --output <path>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load JSON data
// ---------------------------------------------------------------------------

function loadJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const MARKER = '<!-- ancstra-bundle-report -->';
const GROWTH_THRESHOLD = 0.05; // 5%

function toKb(bytes) {
  return (bytes / 1024).toFixed(1);
}

function formatDelta(deltaBytes) {
  const sign = deltaBytes > 0 ? '+' : '';
  return `${sign}${toKb(deltaBytes)}`;
}

function formatPct(pct) {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// No-baseline path
// ---------------------------------------------------------------------------

const current = loadJson(currentPath);
const baseline = loadJson(baselinePath);

if (!baseline) {
  const md = [
    MARKER,
    '',
    '## Bundle size report',
    '',
    '> **No baseline yet** — no cached `main` baseline was found.',
    '> Once this PR is merged the current bundle sizes will be saved as the new baseline.',
    '> On the next PR, a full delta comparison will appear here.',
    '',
  ].join('\n');

  writeFileSync(outputPath, md);
  console.log(md);
  process.exit(0);
}

if (!current) {
  const md = [
    MARKER,
    '',
    '## Bundle size report',
    '',
    '> **Error:** Could not read current bundle analysis JSON.',
    '',
  ].join('\n');

  writeFileSync(outputPath, md);
  console.log(md);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Build delta table
// ---------------------------------------------------------------------------

const allRoutes = new Set([
  ...Object.keys(current).filter(k => !k.startsWith('_')),
  ...Object.keys(baseline).filter(k => !k.startsWith('_')),
]);
const sortedRoutes = [...allRoutes].sort();

const header = [
  '| Route | Baseline (kB) | Current (kB) | Δ kB | Δ % |',
  '|-------|--------------|-------------|------|-----|',
];

const rows = sortedRoutes.map((route) => {
  const baseEntry = baseline[route];
  const currEntry = current[route];

  if (!baseEntry) {
    // New route
    const currKb = toKb(currEntry.raw);
    return `| 🆕 \`${route}\` | — | ${currKb} | — | — |`;
  }

  if (!currEntry) {
    // Removed route
    const baseKb = toKb(baseEntry.raw);
    return `| 🗑 \`${route}\` | ${baseKb} | — | — | — |`;
  }

  const deltaBytes = currEntry.raw - baseEntry.raw;
  const pct = baseEntry.raw > 0 ? deltaBytes / baseEntry.raw : 0;
  const flag = pct > GROWTH_THRESHOLD ? ' 🚨' : '';

  return `| \`${route}\`${flag} | ${toKb(baseEntry.raw)} | ${toKb(currEntry.raw)} | ${formatDelta(deltaBytes)} | ${formatPct(pct)} |`;
});

// Summary line
const totalBase = sortedRoutes.reduce((s, r) => s + (baseline[r]?.raw ?? 0), 0);
const totalCurr = sortedRoutes.reduce((s, r) => s + (current[r]?.raw ?? 0), 0);
const totalDelta = totalCurr - totalBase;
const totalPct = totalBase > 0 ? totalDelta / totalBase : 0;
const warnCount = rows.filter((r) => r.includes('🚨')).length;

const summaryLines = [
  '',
  `**Total First Load JS:** ${toKb(totalBase)} kB (baseline) → ${toKb(totalCurr)} kB (current) — Δ ${formatDelta(totalDelta)} kB (${formatPct(totalPct)})`,
  '',
];

if (warnCount > 0) {
  summaryLines.push(
    `> 🚨 **${warnCount} route${warnCount > 1 ? 's' : ''} grew >5%** — please review the delta above.`,
    '',
  );
}

summaryLines.push(
  '_🆕 = new route · 🗑 = removed route · 🚨 = First Load JS grew >5%_',
  '',
);

const calloutLines = current._meta?.perRouteAccuracy === 'shared-only'
  ? [
      '',
      '> ⚠️ **App Router project**: per-route sizes reflect shared chunks only. Individual route deltas are not reliable; rely on the totals row.',
    ]
  : [];

const md = [
  MARKER,
  '',
  '## Bundle size report',
  ...calloutLines,
  '',
  ...header,
  ...rows,
  ...summaryLines,
].join('\n');

writeFileSync(outputPath, md);
console.log(md);
process.exit(0);
