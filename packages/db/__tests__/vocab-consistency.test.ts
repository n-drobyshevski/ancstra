import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  CONFIDENCE_BAND_META,
  CONFIDENCE_BANDS,
  CLUSTER_OP_REFUSAL_KINDS,
  // Bundle E:
  SEARCH_PROVIDER_KINDS,
  SEARCH_OUTCOMES,
  SEARCH_OUTCOMES_REQUIRING_NOTES,
} from '../src/vocab';

const REPO_ROOT = path.resolve(__dirname, '../../..');

// Old vocab strings retired in Bundle A 2026-05-23.
const FORBIDDEN_RESEARCH_ITEM_STATUS = ["'draft'", "'ready'", "'promoted'", "'merged'", "'dismissed'"];
const FORBIDDEN_CONFIDENCE = ["'disputed'"];

const EXCLUDED_PATHS = [
  /[\\/]migrations[\\/]/,
  /[\\/]__tests__[\\/]/,
  /vocab\.ts$/,
  /CHANGELOG\.md$/,
  /node_modules/,
  /\.next/,
  /\.turbo/,
  /\.git/,
  /\.gitignore/,
  /[\\/]docs[\\/]/,
  /[\\/]messages[\\/]/, // i18n keys may legitimately use these words
];

const SCAN_DIRS = ['packages', 'apps'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (EXCLUDED_PATHS.some((rx) => rx.test(p))) continue;
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...walk(p));
    } else if (s.isFile() && /\.(ts|tsx)$/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

function scanLine(line: string): boolean {
  // Skip comment lines — they may reference retired vocab by name for documentation.
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;

  const isItemContext = /research[_-]?item|item\.status|item_status/i.test(line);
  const isFactContext = /research[_-]?fact|fact\.confidence|confidence:\s*['"]disputed['"]/i.test(line);

  if (isItemContext) {
    // Skip SQL backfill UPDATE lines: these set a NEW vocab value and only
    // reference the legacy string in the WHERE clause (i.e. migrating FROM old).
    // Pattern: SET status = '<new_value>' WHERE status [=|IN] '<legacy>'
    const isBackfillUpdate = /SET\s+status\s*=\s*'(?:collected|processed|extracted|discarded)'\s+WHERE/i.test(line);
    if (isBackfillUpdate) return false;

    for (const lit of FORBIDDEN_RESEARCH_ITEM_STATUS) {
      if (line.includes(lit)) return true;
    }
  }
  if (isFactContext) {
    for (const lit of FORBIDDEN_CONFIDENCE) {
      if (line.includes(lit)) return true;
    }
  }
  return false;
}

describe('CONFIDENCE_BAND_META (Bundle C)', () => {
  it('has a key for every confidence band', () => {
    const metaKeys = Object.keys(CONFIDENCE_BAND_META).sort();
    const bandValues = [...CONFIDENCE_BANDS].sort();
    expect(metaKeys).toEqual(bandValues);
  });

  it('messageKey matches the band name', () => {
    for (const band of CONFIDENCE_BANDS) {
      expect(CONFIDENCE_BAND_META[band].messageKey).toBe(`rubric.${band}`);
    }
  });

  it('scoreLabel is non-empty', () => {
    for (const band of CONFIDENCE_BANDS) {
      expect(CONFIDENCE_BAND_META[band].scoreLabel.length).toBeGreaterThan(0);
    }
  });
});

describe('CLUSTER_OP_REFUSAL_KINDS (Bundle D)', () => {
  it('contains exactly the three Bundle D refusal kinds', () => {
    expect([...CLUSTER_OP_REFUSAL_KINDS].sort()).toEqual(
      ['ClusterDetachNotSupported', 'ClusterMemberUseClusterUnmerge', 'LegacyClusterNotSupported'].sort(),
    );
  });

  // AST guard: every kind in CLUSTER_OP_REFUSAL_KINDS must correspond to an
  // exported error class in `packages/research/src/factsheets/cluster.ts`
  // with a matching `.kind` field literal. Regex-grep matches the existing
  // AST-guard pattern in this file (Bundle A's scanLine approach).
  it('every refusal kind maps to an error class with matching `.kind` in cluster.ts', () => {
    const clusterSrc = readFileSync(
      path.resolve(__dirname, '../../research/src/factsheets/cluster.ts'),
      'utf8',
    );
    for (const kind of CLUSTER_OP_REFUSAL_KINDS) {
      // Each kind must appear as `readonly kind = '<kind>' as const` on an
      // exported class — that's how the discriminated union narrows at call sites.
      expect(clusterSrc).toMatch(new RegExp(`readonly kind = '${kind}' as const`));
    }
  });

  it('every refusal kind has an `export class <Kind>Error` declaration in cluster.ts', () => {
    const clusterSrc = readFileSync(
      path.resolve(__dirname, '../../research/src/factsheets/cluster.ts'),
      'utf8',
    );
    for (const kind of CLUSTER_OP_REFUSAL_KINDS) {
      expect(clusterSrc).toMatch(new RegExp(`export class ${kind}Error extends Error`));
    }
  });
});

describe('SEARCH_PROVIDER_KINDS / SEARCH_OUTCOMES (Bundle E)', () => {
  it('SEARCH_PROVIDER_KINDS contains exactly the 10 locked kinds (spec E-Q4)', () => {
    expect([...SEARCH_PROVIDER_KINDS].sort()).toEqual([
      'familysearch', 'ancestry', 'myheritage', 'findmypast',
      'geni', 'wikitree',
      'archive', 'library', 'family', 'other',
    ].sort());
  });

  it('SEARCH_OUTCOMES contains exactly 3 locked values (spec E-Q7)', () => {
    expect([...SEARCH_OUTCOMES].sort()).toEqual(
      ['found', 'inconclusive', 'negative'].sort(),
    );
  });

  it('SEARCH_OUTCOMES_REQUIRING_NOTES contains exactly negative + inconclusive (spec E-Q8)', () => {
    expect([...SEARCH_OUTCOMES_REQUIRING_NOTES].sort()).toEqual(['inconclusive', 'negative']);
  });

  it('declaration order: all 6 frequent providers precede all 4 ad-hoc kinds', () => {
    // Spec §2.2: declaration order drives the form select dropdown. The 6
    // "frequent provider" kinds come first; the 4 ad-hoc kinds last.
    const FREQUENT = ['familysearch', 'ancestry', 'myheritage', 'findmypast', 'geni', 'wikitree'] as const;
    const ADHOC    = ['archive', 'library', 'family', 'other'] as const;
    const arr = [...SEARCH_PROVIDER_KINDS];
    const lastFrequentIdx = Math.max(...FREQUENT.map((k) => arr.indexOf(k)));
    const firstAdHocIdx   = Math.min(...ADHOC.map((k) => arr.indexOf(k)));
    expect(lastFrequentIdx).toBeLessThan(firstAdHocIdx);
  });
});

describe('vocab consistency (Bundle A guard)', () => {
  // Walks the whole repo's apps/ + packages/ tree (~thousands of statSync calls)
  // — passes in ~600ms in isolation but the default 5s timeout fires under CPU
  // contention when vitest parallelises with other test files. 30s is generous
  // headroom that still catches a genuine infinite-loop regression.
  it('no legacy research_items.status or research_facts.confidence literals remain in src', { timeout: 30_000 }, () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const dir of SCAN_DIRS) {
      const root = path.join(REPO_ROOT, dir);
      try {
        for (const file of walk(root)) {
          const text = readFileSync(file, 'utf8');
          text.split(/\r?\n/).forEach((line, i) => {
            if (scanLine(line)) {
              offenders.push({ file: path.relative(REPO_ROOT, file), line: i + 1, text: line.trim() });
            }
          });
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `  ${o.file}:${o.line} -- ${o.text}`).join('\n');
      throw new Error(`Found ${offenders.length} legacy vocab literal(s):\n${summary}`);
    }
    expect(offenders).toHaveLength(0);
  });
});
