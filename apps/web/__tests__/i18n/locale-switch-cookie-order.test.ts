import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * Regression anchor for [[feedback_next_intl_as_needed_cookie]]:
 *   Under `localePrefix: 'as-needed'` (our setting in i18n/routing.ts), the
 *   default locale (`en`) renders WITHOUT a `/en` prefix. When the user
 *   switches `ru → en`, next-intl's middleware tries to resolve the new
 *   locale; if the `NEXT_LOCALE` cookie still holds `'ru'` at that moment,
 *   the middleware fires a 307 redirect back to `/ru/...`, silently
 *   bouncing the user into the old locale.
 *
 *   The fix: write `NEXT_LOCALE=<next>` to `document.cookie` *before*
 *   calling `router.replace(targetPath)`. The cookie write must happen
 *   synchronously on the same JS tick as the locale switch.
 *
 * This test statically asserts the call order in both locale-switcher
 * components. If a future refactor reorders the calls (e.g., puts the
 * cookie write inside the `startTransition` callback after
 * `router.replace`), the test surfaces the bug at CI rather than letting
 * it ship.
 */

const APPS_WEB = join(__dirname, '..', '..');

const LOCALE_SWITCHERS = [
  'components/sidebar/locale-switcher.tsx',
  'components/auth/public-locale-switcher.tsx',
] as const;

function parse(filePath: string): ts.SourceFile {
  const src = readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function findFunctionByName(sf: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return found;
}

interface OrderPoint {
  kind: 'cookie' | 'router-replace';
  position: number;
  text: string;
}

function collectOrderPoints(node: ts.Node, sf: ts.SourceFile): OrderPoint[] {
  const points: OrderPoint[] = [];
  function visit(n: ts.Node): void {
    if (ts.isCallExpression(n)) {
      const expr = n.expression;
      const calleeName =
        ts.isIdentifier(expr) ? expr.text :
        ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name) ? expr.name.text :
        null;
      if (calleeName === 'writeLocaleCookie') {
        points.push({ kind: 'cookie', position: n.getStart(sf), text: n.getText(sf).slice(0, 60) });
      } else if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'router' &&
        ts.isIdentifier(expr.name) &&
        expr.name.text === 'replace'
      ) {
        points.push({ kind: 'router-replace', position: n.getStart(sf), text: n.getText(sf).slice(0, 60) });
      }
    }
    // Also catch `document.cookie = ...` assignments as cookie writes —
    // belt-and-suspenders if writeLocaleCookie is ever inlined.
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(n.left) &&
      ts.isIdentifier(n.left.expression) &&
      n.left.expression.text === 'document' &&
      ts.isIdentifier(n.left.name) &&
      n.left.name.text === 'cookie'
    ) {
      points.push({ kind: 'cookie', position: n.getStart(sf), text: n.getText(sf).slice(0, 60) });
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return points;
}

describe('locale switch — cookie write precedes router.replace', () => {
  it.each(LOCALE_SWITCHERS)(
    '%s: switchTo() writes NEXT_LOCALE cookie BEFORE calling router.replace',
    (relPath) => {
      const fullPath = join(APPS_WEB, relPath);
      const sf = parse(fullPath);

      const switchTo = findFunctionByName(sf, 'switchTo');
      expect(switchTo, `expected ${relPath} to declare a switchTo() function`).toBeDefined();

      const points = collectOrderPoints(switchTo!, sf);
      const cookies = points.filter((p) => p.kind === 'cookie');
      const replaces = points.filter((p) => p.kind === 'router-replace');

      expect(cookies.length, `${relPath} writes no NEXT_LOCALE cookie inside switchTo()`).toBeGreaterThanOrEqual(1);
      expect(replaces.length, `${relPath} never calls router.replace inside switchTo()`).toBeGreaterThanOrEqual(1);

      // The latest cookie write must still precede the earliest router.replace.
      const lastCookieAt = Math.max(...cookies.map((c) => c.position));
      const firstReplaceAt = Math.min(...replaces.map((r) => r.position));
      expect(
        lastCookieAt,
        `In ${relPath}, the cookie write at offset ${lastCookieAt} must come before router.replace at offset ${firstReplaceAt}`,
      ).toBeLessThan(firstReplaceAt);
    },
  );

  it('the NEXT_LOCALE cookie name is unchanged in both switchers (stops accidental renames)', () => {
    for (const relPath of LOCALE_SWITCHERS) {
      const src = readFileSync(join(APPS_WEB, relPath), 'utf8');
      expect(src, `${relPath} no longer writes NEXT_LOCALE`).toMatch(/NEXT_LOCALE=/);
    }
  });
});
