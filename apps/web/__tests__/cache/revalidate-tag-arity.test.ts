import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';

/**
 * Regression anchor for commits 5ae1584 + b26b347 (chronological yo-yo):
 *   - 5ae1584 *removed* the second argument believing it was deprecated.
 *   - b26b347 *restored* the second `'max'` profile argument because in
 *     Next.js 16 `revalidateTag(tag, profile)` requires a profile to
 *     enable stale-while-revalidate semantics. A single-arg call now
 *     loses the SWR semantics.
 *
 * The current correct form across this codebase is
 *   `revalidateTag(<tag>, 'max')`
 * with both literal and template-literal tag forms. This scanner asserts:
 *   1. Every revalidateTag(...) call has exactly TWO arguments.
 *   2. The second argument is the string literal 'max'. (Allowing a
 *      different profile would be a deliberate decision deserving a
 *      separate code change + this test update.)
 *
 * Both halves trip if someone yo-yo's the pattern again or copies a
 * single-arg call from older code.
 *
 * Cheap and low-flake: no runtime, no DB, just TypeScript AST.
 */

const APPS_WEB = join(__dirname, '..', '..');
const SCAN_ROOTS = ['app', 'lib', 'server', 'components'];

function* walkTsFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
      yield* walkTsFiles(full);
    } else if (st.isFile() && /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      yield full;
    }
  }
}

interface CallSite {
  filePath: string;
  line: number;
  argCount: number;
  secondArgText: string | null;
  secondArgIsMaxLiteral: boolean;
  text: string;
}

function findRevalidateTagCalls(filePath: string): CallSite[] {
  const source = readFileSync(filePath, 'utf8');
  if (!source.includes('revalidateTag')) return [];
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls: CallSite[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      // Match either `revalidateTag(...)` or `something.revalidateTag(...)`.
      const name =
        ts.isIdentifier(expr) ? expr.text :
        ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name) ? expr.name.text :
        null;
      if (name === 'revalidateTag') {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const secondArg = node.arguments[1];
        const secondArgText = secondArg ? secondArg.getText(sf) : null;
        const secondArgIsMaxLiteral = !!secondArg && ts.isStringLiteral(secondArg) && secondArg.text === 'max';
        calls.push({
          filePath,
          line: line + 1,
          argCount: node.arguments.length,
          secondArgText,
          secondArgIsMaxLiteral,
          text: node.getText(sf).slice(0, 120),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return calls;
}

function collectAllCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const root of SCAN_ROOTS) {
    const dir = join(APPS_WEB, root);
    try {
      statSync(dir);
    } catch {
      continue;
    }
    for (const file of walkTsFiles(dir)) {
      sites.push(...findRevalidateTagCalls(file));
    }
  }
  return sites;
}

function formatViolator(v: CallSite): string {
  return `  ${relative(APPS_WEB, v.filePath).split(sep).join('/')}:${v.line} (${v.argCount} args) — ${v.text}`;
}

describe("revalidateTag — Next.js 16 (tag, 'max') signature", () => {
  const sites = collectAllCallSites();

  it('finds a meaningful number of call sites (sanity floor)', () => {
    // ~111 sites today (grep count 2026-05-21). If the AST walker drops
    // to 0 the scanner itself is broken and the rest of this suite is
    // vacuously green — so guard against it.
    expect(sites.length).toBeGreaterThan(20);
  });

  it('every revalidateTag(...) call has exactly two arguments', () => {
    const violators = sites.filter((s) => s.argCount !== 2);
    if (violators.length > 0) {
      throw new Error(
        `revalidateTag must be called as (tag, 'max') in Next.js 16. ` +
          `Found ${violators.length} arity violator(s):\n${violators.map(formatViolator).join('\n')}`,
      );
    }
    expect(violators).toHaveLength(0);
  });

  it("every revalidateTag(...) call passes the literal 'max' as its second argument", () => {
    // Catches drift to an alternate profile (e.g., 'minutes') — that's a
    // deliberate semantic change deserving a separate review.
    const violators = sites.filter((s) => s.argCount === 2 && !s.secondArgIsMaxLiteral);
    if (violators.length > 0) {
      const detail = violators
        .map((v) => `  ${relative(APPS_WEB, v.filePath).split(sep).join('/')}:${v.line} — second arg = ${v.secondArgText}`)
        .join('\n');
      throw new Error(
        `revalidateTag's second argument must be the string literal 'max'. ` +
          `Found ${violators.length} non-'max' second arg(s):\n${detail}`,
      );
    }
    expect(violators).toHaveLength(0);
  });
});
