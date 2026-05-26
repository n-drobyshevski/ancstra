import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Static AST guard — Bundle E Task 8.
 *
 * Ensures 'research-log' is wired in all three key locations in
 * workspace-tabs.tsx so it never accidentally gets dropped during a refactor:
 *   1. WorkspaceView union
 *   2. TAB_GROUPS Core group
 *   3. PRIMARY_TAB_VALUES
 *
 * No DOM rendering needed — pure text scanning is sufficient and cheaper.
 */

const TABS_FILE = join(
  __dirname,
  '..',
  '..',
  'components',
  'research',
  'workspace',
  'workspace-tabs.tsx',
);

describe("workspace-tabs 'research-log' wiring (Bundle E Task 8)", () => {
  const src = readFileSync(TABS_FILE, 'utf8');

  it("includes 'research-log' in the WorkspaceView union", () => {
    expect(src).toMatch(/'research-log'/);
  });

  it("includes 'research-log' in TAB_GROUPS", () => {
    expect(src).toMatch(/value:\s*'research-log'/);
  });

  it("includes 'research-log' in PRIMARY_TAB_VALUES", () => {
    // The set literal must contain 'research-log'. Find the block between
    // PRIMARY_TAB_VALUES and the closing paren of the Set constructor.
    const idx = src.indexOf('PRIMARY_TAB_VALUES');
    const block = idx >= 0 ? src.slice(idx, idx + 200) : '';
    expect(block).toContain("'research-log'");
  });

  it('getBadge handles research-log case', () => {
    expect(src).toMatch(/value === 'research-log'/);
  });
});
