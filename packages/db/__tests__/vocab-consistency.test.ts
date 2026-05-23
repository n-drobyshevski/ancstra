import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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
