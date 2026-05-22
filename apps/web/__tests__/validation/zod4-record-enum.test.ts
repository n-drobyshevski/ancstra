import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';
import { z, ZodError } from 'zod';

/**
 * Regression anchor for [[feedback_zod4_record_enum]]:
 *   In Zod v4, `z.record(z.enum([...]), valueSchema)` was reinterpreted as
 *   an exhaustive map — parsing a partial input like `{ biography: true }`
 *   throws `ZodError("expected boolean, received undefined")` for every
 *   missing enum key. TypeScript misses it (the type is still
 *   `Partial<Record<...>>`); only the runtime parser fails.
 *
 *   For partial-patch inputs (typical tRPC mutation inputs where users
 *   send only the keys they're changing) the correct shape is an explicit
 *   `z.object({ k1: v.optional(), k2: v.optional(), ... })`.
 *
 *   `apps/web/server/api/routers/experimental.ts` uses the correct shape
 *   today. This test anchors:
 *     1. A live demo of the v4 behaviour (so the test breaks loudly if
 *        Zod ever reverts to partial semantics — at which point we'd want
 *        to delete this whole guard).
 *     2. An AST scan asserting no production source uses
 *        `z.record(z.enum(...), ...)`.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

describe('Zod 4 — z.record(z.enum, v) partial-patch gotcha', () => {
  it('demonstrates the bug: z.record(z.enum, v).parse({partial}) throws when keys are missing', () => {
    const schema = z.record(
      z.enum(['biography', 'researchChat', 'historicalContext']),
      z.boolean(),
    );
    // Partial input (only one of the three keys present).
    let caught: unknown = null;
    try {
      schema.parse({ biography: true });
    } catch (err) {
      caught = err;
    }
    expect(caught, 'expected ZodError for partial input in Zod v4').toBeInstanceOf(ZodError);
    // Spot-check the error message references the missing keys.
    const issues = (caught as ZodError).issues;
    expect(issues.length).toBeGreaterThan(0);
    // Issue should be about missing/invalid keys.
    expect(
      issues.some((i) => /received undefined|invalid_type/i.test(JSON.stringify(i))),
      `expected an "undefined" or "invalid_type" issue; got ${JSON.stringify(issues)}`,
    ).toBe(true);
  });

  it('demonstrates the fix: explicit z.object({k: v.optional()}) parses partials cleanly', () => {
    const schema = z.object({
      biography: z.boolean().optional(),
      researchChat: z.boolean().optional(),
      historicalContext: z.boolean().optional(),
    });
    expect(schema.parse({ biography: true })).toEqual({ biography: true });
    expect(schema.parse({})).toEqual({});
    expect(schema.parse({ historicalContext: false, researchChat: true })).toEqual({
      historicalContext: false,
      researchChat: true,
    });
  });

  it('demonstrates the symmetry: z.object form still rejects unknown keys (default strip) and wrong types', () => {
    const schema = z.object({
      biography: z.boolean().optional(),
    });
    // Wrong type still fails.
    expect(() => schema.parse({ biography: 'yes' })).toThrow(ZodError);
    // Unknown keys are stripped by default in Zod 4 (default behaviour).
    expect(schema.parse({ biography: true, _spurious: 1 })).toEqual({ biography: true });
  });
});

interface Violation {
  file: string;
  line: number;
  text: string;
}

function* walkTsFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__' || entry === 'coverage') continue;
      yield* walkTsFiles(full);
    } else if (st.isFile() && /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      yield full;
    }
  }
}

// Returns true if a CallExpression is `z.record(<first arg>, ...)` and
// the first argument is itself a `z.enum(...)` call.
function isZRecordOfEnum(node: ts.CallExpression): boolean {
  const expr = node.expression;
  const isZRecord =
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'z' &&
    ts.isIdentifier(expr.name) &&
    expr.name.text === 'record';
  if (!isZRecord) return false;
  const firstArg = node.arguments[0];
  if (!firstArg || !ts.isCallExpression(firstArg)) return false;
  const inner = firstArg.expression;
  return (
    ts.isPropertyAccessExpression(inner) &&
    ts.isIdentifier(inner.expression) &&
    inner.expression.text === 'z' &&
    ts.isIdentifier(inner.name) &&
    inner.name.text === 'enum'
  );
}

function findZRecordEnumCalls(): Violation[] {
  const violations: Violation[] = [];
  const SCAN_ROOTS = [
    join(REPO_ROOT, 'apps', 'web'),
    join(REPO_ROOT, 'packages'),
  ];
  for (const root of SCAN_ROOTS) {
    try {
      statSync(root);
    } catch {
      continue;
    }
    for (const file of walkTsFiles(root)) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('z.record(')) continue;
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(n: ts.Node): void {
        if (ts.isCallExpression(n) && isZRecordOfEnum(n)) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          violations.push({
            file: relative(REPO_ROOT, file).split(sep).join('/'),
            line: line + 1,
            text: n.getText(sf).slice(0, 120),
          });
        }
        ts.forEachChild(n, visit);
      }
      visit(sf);
    }
  }
  return violations;
}

describe('codebase posture — no z.record(z.enum(...), ...) call sites', () => {
  it('no production .ts/.tsx file uses z.record(z.enum(...), ...) (use explicit z.object instead)', () => {
    const violations = findZRecordEnumCalls();
    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  ${v.file}:${v.line} — ${v.text}`)
        .join('\n');
      throw new Error(
        `${violations.length} z.record(z.enum, ...) call(s) found — partial patches will throw at runtime ` +
          `under Zod 4 ([[feedback_zod4_record_enum]]). Use explicit z.object({k: v.optional()}) form:\n${detail}`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
