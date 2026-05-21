import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';

/**
 * Regression anchor for [[feedback_setrequestlocale_propagation]]:
 *   Under Next.js 16 cacheComponents, `setRequestLocale(locale)` in
 *   `app/[locale]/layout.tsx` does NOT propagate through `<Suspense>`
 *   boundaries to deferred async server children. Every Suspense'd async
 *   section that calls `getTranslations(...)` must call
 *   `setRequestLocale(locale)` itself first, otherwise `getTranslations`
 *   silently falls back to `routing.defaultLocale` ('en') and `/ru/*`
 *   routes render English for their server-rendered subtree.
 *
 *   The escape hatch is the explicit-locale form
 *     getTranslations({ locale, namespace })
 *   which passes locale through directly. We accept that form without a
 *   prior setRequestLocale.
 *
 * Strategy: AST-scan every `page.tsx` under `app/[locale]/`. For each
 * async function declaration in the file, walk the body for
 * `getTranslations(...)` calls. If any call uses the bare form (string
 * arg or object without a `locale` property), the function body must
 * contain a `setRequestLocale(...)` call at an earlier source position.
 */

const APPS_WEB = join(__dirname, '..', '..');
const LOCALE_ROOT = join(APPS_WEB, 'app', '[locale]');

function* walkPageFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      yield* walkPageFiles(full);
    } else if (st.isFile() && (entry === 'page.tsx' || entry === 'layout.tsx')) {
      yield full;
    }
  }
}

interface GetTranslationsCall {
  position: number;
  isBare: boolean;
  text: string;
}

interface SetRequestLocaleCall {
  position: number;
}

function isBareGetTranslations(arg: ts.Expression | undefined): boolean {
  if (!arg) return true; // getTranslations() with no args — bare
  if (ts.isStringLiteral(arg)) return true;
  if (ts.isObjectLiteralExpression(arg)) {
    // Bare unless the object has a `locale` property.
    const hasLocale = arg.properties.some((p) => {
      const name =
        ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) ? p.name.text :
        ts.isShorthandPropertyAssignment(p) ? p.name.text :
        null;
      return name === 'locale';
    });
    return !hasLocale;
  }
  // Conservative: if it's an identifier or call expression we can't statically
  // tell — treat as bare so it gets gated by setRequestLocale anyway.
  return true;
}

function analyzeFunction(fn: ts.FunctionLikeDeclaration, sf: ts.SourceFile) {
  const getTranslations: GetTranslationsCall[] = [];
  const setRequestLocale: SetRequestLocaleCall[] = [];
  function visit(n: ts.Node): void {
    // Don't descend into nested function definitions — they have their own scope.
    if (n !== fn && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n))) {
      return;
    }
    if (ts.isCallExpression(n)) {
      const expr = n.expression;
      const name = ts.isIdentifier(expr) ? expr.text : null;
      if (name === 'getTranslations') {
        getTranslations.push({
          position: n.getStart(sf),
          isBare: isBareGetTranslations(n.arguments[0]),
          text: n.getText(sf).slice(0, 80),
        });
      } else if (name === 'setRequestLocale') {
        setRequestLocale.push({ position: n.getStart(sf) });
      }
    }
    ts.forEachChild(n, visit);
  }
  if (fn.body) visit(fn.body);
  return { getTranslations, setRequestLocale };
}

function findAsyncFunctionLikeDeclarations(sf: ts.SourceFile): ts.FunctionLikeDeclaration[] {
  const out: ts.FunctionLikeDeclaration[] = [];
  function isAsync(node: ts.FunctionLikeDeclarationBase): boolean {
    return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  }
  function visit(n: ts.Node): void {
    if (ts.isFunctionDeclaration(n) && isAsync(n)) out.push(n);
    if (ts.isArrowFunction(n) && isAsync(n)) out.push(n);
    if (ts.isFunctionExpression(n) && isAsync(n)) out.push(n);
    if (ts.isMethodDeclaration(n) && isAsync(n)) out.push(n);
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return out;
}

interface Violation {
  file: string;
  line: number;
  fnName: string;
  callText: string;
  reason: string;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  try {
    statSync(LOCALE_ROOT);
  } catch {
    return violations;
  }

  for (const file of walkPageFiles(LOCALE_ROOT)) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('getTranslations')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    for (const fn of findAsyncFunctionLikeDeclarations(sf)) {
      const { getTranslations, setRequestLocale } = analyzeFunction(fn, sf);
      const bareCalls = getTranslations.filter((c) => c.isBare);
      if (bareCalls.length === 0) continue;

      const firstBare = bareCalls.reduce((a, b) => (a.position < b.position ? a : b));
      const setBefore = setRequestLocale.some((s) => s.position < firstBare.position);

      if (!setBefore) {
        const { line } = sf.getLineAndCharacterOfPosition(firstBare.position);
        const fnName =
          ts.isFunctionDeclaration(fn) && fn.name ? fn.name.text :
          ts.isMethodDeclaration(fn) && ts.isIdentifier(fn.name) ? fn.name.text :
          '<anonymous>';
        violations.push({
          file: relative(APPS_WEB, file).split(sep).join('/'),
          line: line + 1,
          fnName,
          callText: firstBare.text,
          reason: setRequestLocale.length === 0
            ? 'function never calls setRequestLocale'
            : 'all setRequestLocale calls occur AFTER the bare getTranslations call',
        });
      }
    }
  }
  return violations;
}

/**
 * Allowlist of known pre-existing violators. Empty as of 2026-05-21 — the
 * original 11 entries (admin/* pages + join/page.tsx) were fixed in the
 * same PR that ships this test. Keeping the allowlist mechanism in place
 * so any future "land the test now, fix the violator later" situation has
 * the seam available.
 *
 * Fix recipe (for any future entry): either add `setRequestLocale(locale)`
 * after `await params` (adding `locale` to the params destructure if
 * absent), or use the explicit `getTranslations({ locale, namespace })`
 * form which threads locale through without needing setRequestLocale.
 */
const KNOWN_VIOLATORS = new Set<string>([]);

describe('setRequestLocale gates bare getTranslations under cacheComponents', () => {
  const violations = findViolations();
  const violationKeys = new Set(violations.map((v) => `${v.file}::${v.fnName}`));

  it('scans at least a handful of page.tsx files (sanity floor)', () => {
    // The locale subtree has many page.tsx files; if we somehow found zero
    // the scanner is broken.
    let scannedFiles = 0;
    for (const _ of walkPageFiles(LOCALE_ROOT)) scannedFiles++;
    expect(scannedFiles).toBeGreaterThan(5);
  });

  it('no NEW async function calls bare getTranslations() without preceding setRequestLocale (allowlist of known TODOs)', () => {
    const newViolators = violations.filter((v) => !KNOWN_VIOLATORS.has(`${v.file}::${v.fnName}`));
    if (newViolators.length > 0) {
      const detail = newViolators
        .map((v) => `  ${v.file}:${v.line} in ${v.fnName}() — ${v.reason}\n      ${v.callText}`)
        .join('\n');
      throw new Error(
        `${newViolators.length} NEW async function(s) call bare getTranslations() ` +
          `without a preceding setRequestLocale(locale). Under Next.js 16 ` +
          `cacheComponents this falls back to defaultLocale ('en') for the ` +
          `server-rendered subtree:\n${detail}\n` +
          `Fix: add setRequestLocale(locale) before getTranslations, OR use ` +
          `the explicit getTranslations({ locale, namespace }) form.`,
      );
    }
    expect(newViolators).toHaveLength(0);
  });

  it('every KNOWN_VIOLATORS entry still triggers (catches stale allowlist)', () => {
    const stale = [...KNOWN_VIOLATORS].filter((entry) => !violationKeys.has(entry));
    if (stale.length > 0) {
      throw new Error(
        `${stale.length} entry in KNOWN_VIOLATORS is no longer a violator — ` +
          `remove it from the allowlist:\n${stale.map((s) => `  ${s}`).join('\n')}`,
      );
    }
    expect(stale).toHaveLength(0);
  });
});
