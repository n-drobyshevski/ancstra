import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * Regression anchor for [[feedback_use_cache_null]] (incident: 2026-04-21
 * `/admin/families/[id]` 404'd for ~5 min after a transient DB blip baked
 * `null` into the `'use cache'` window).
 *
 * The pattern that prevents this bug at the page level:
 *
 *   if (!(await xExists(db, id))) notFound();   // uncached existence check
 *   const data = await getCachedXDetail(id);    // 'use cache' wrapper
 *   if (!data) notFound();                       // belt-and-suspenders for races
 *
 * This scanner enforces the pattern on every page that currently has a
 * cached detail loader. The set is small today (2 admin pages), but the
 * walkers below auto-detect future additions via the
 * `findCachedDetailLoaders` heuristic and require each one to be paired
 * with an uncached existence check inside the same function body.
 */

const APPS_WEB = join(__dirname, '..', '..');

/** Pages that currently use `'use cache'` + an existence check pattern. */
const KNOWN_PAGE_CASES: Array<{
  pagePath: string;
  cachedLoaderName: string;
  existsHelperName: string;
}> = [
  {
    pagePath: 'app/[locale]/(admin)/admin/families/[id]/page.tsx',
    cachedLoaderName: 'getCachedFamilyDetail',
    existsHelperName: 'familyExists',
  },
  {
    pagePath: 'app/[locale]/(admin)/admin/users/[id]/page.tsx',
    cachedLoaderName: 'getCachedUserDetail',
    existsHelperName: 'userExists',
  },
];

function parse(filePath: string): ts.SourceFile {
  const src = readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

interface CallInfo {
  name: string;
  position: number;
  functionName: string;
}

/**
 * Walk all call expressions in `sf`, recording position + enclosing function
 * name. Used to verify call ordering inside the same function body.
 */
function collectCalls(sf: ts.SourceFile, names: Set<string>): CallInfo[] {
  const found: CallInfo[] = [];

  function enclosingFunctionName(node: ts.Node): string {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
      if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
      // ArrowFunction or FunctionExpression assigned to a const: use the
      // variable name. Walk up one extra level to the VariableDeclaration.
      if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
        let p: ts.Node | undefined = current.parent;
        while (p && !ts.isVariableDeclaration(p)) p = p.parent;
        if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
        return '<anonymous>';
      }
      current = current.parent;
    }
    return '<top-level>';
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const name =
        ts.isIdentifier(expr) ? expr.text :
        ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name) ? expr.name.text :
        null;
      if (name && names.has(name)) {
        found.push({
          name,
          position: node.getStart(sf),
          functionName: enclosingFunctionName(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return found;
}

describe('use-cache null-bake — uncached existence check precedes cached detail loader', () => {
  it.each(KNOWN_PAGE_CASES)(
    '$pagePath calls $existsHelperName before $cachedLoaderName in every function that uses the cached loader',
    ({ pagePath, cachedLoaderName, existsHelperName }) => {
      const fullPath = join(APPS_WEB, pagePath);
      expect(existsSync(fullPath), `expected page file ${pagePath} to exist`).toBe(true);

      const sf = parse(fullPath);
      const calls = collectCalls(sf, new Set([cachedLoaderName, existsHelperName]));

      // Group by enclosing function: any function that calls the cached
      // loader must also call the exists helper, and the exists call must
      // come first textually.
      const byFunction = new Map<string, CallInfo[]>();
      for (const c of calls) {
        if (!byFunction.has(c.functionName)) byFunction.set(c.functionName, []);
        byFunction.get(c.functionName)!.push(c);
      }

      let foundAtLeastOneCachedCallSite = false;
      for (const [fn, list] of byFunction) {
        const cachedCall = list.find((c) => c.name === cachedLoaderName);
        if (!cachedCall) continue; // function only does existence check; fine
        foundAtLeastOneCachedCallSite = true;
        const existsCall = list.find((c) => c.name === existsHelperName);
        expect(
          existsCall,
          `function ${fn}() in ${pagePath} calls ${cachedLoaderName} without first calling ${existsHelperName}`,
        ).toBeDefined();
        expect(
          existsCall!.position,
          `${existsHelperName} must appear before ${cachedLoaderName} in ${fn}() of ${pagePath}`,
        ).toBeLessThan(cachedCall.position);
      }

      expect(
        foundAtLeastOneCachedCallSite,
        `${pagePath} no longer references ${cachedLoaderName} — update KNOWN_PAGE_CASES or remove this entry`,
      ).toBe(true);
    },
  );

  it('the listed *Exists helpers are still exported by @ancstra/auth/admin', () => {
    const adminQueries = readFileSync(
      join(APPS_WEB, '..', '..', 'packages', 'auth', 'src', 'admin-queries.ts'),
      'utf8',
    );
    for (const { existsHelperName } of KNOWN_PAGE_CASES) {
      expect(
        adminQueries,
        `expected packages/auth/src/admin-queries.ts to still export ${existsHelperName}`,
      ).toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+${existsHelperName}\\b`));
    }
  });
});
