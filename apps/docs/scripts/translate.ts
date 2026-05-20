#!/usr/bin/env tsx
/**
 * EN -> RU translation script for apps/docs.
 *
 * For each apps/docs/content/en/<path>.mdx, generate the RU mirror at
 * apps/docs/content/ru/<same-path>.mdx using Claude (sonnet).
 *
 * Skips files whose existing RU frontmatter `translation.source_rev`
 * matches the latest EN git SHA — re-running is cheap and idempotent.
 *
 * Preserves: frontmatter keys, MDX syntax, JSX/components, code fences,
 * relative links, headings. Translates only natural-language prose.
 *
 * Required env: ANTHROPIC_API_KEY (loaded via tsx --env-file flag in package.json)
 */

import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import matter from 'gray-matter';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const EN_DIR = join(REPO_ROOT, 'apps', 'docs', 'content', 'en');
const RU_DIR = join(REPO_ROOT, 'apps', 'docs', 'content', 'ru');
const MODEL_ID = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a professional technical translator. You translate Markdown / MDX documentation from English to Russian for a genealogy software product called Ancstra.

RULES:
1. Translate only natural-language prose (headings, paragraphs, list items, blockquotes, table cells).
2. Do NOT translate: code blocks (\`\`\`...\`\`\` and inline \`code\`), JSX/MDX component names and props, frontmatter keys, URLs, file paths, brand names ("Ancstra", "GEDCOM", "Claude"), technical terms commonly left in English in Russian software documentation (e.g. "API", "SDK") — use your judgement; when unsure, leave the English term and add a Russian gloss in parentheses on first use.
3. Preserve the exact MDX structure: every \`import\` statement (and keep imports at the top of the file, before any prose or JSX), every JSX tag and its attributes, every code fence, every relative link, every heading level.
4. Preserve frontmatter as YAML. Translate the VALUES of \`title\` and \`description\` if present. Leave other frontmatter keys/values unchanged.
5. Output ONLY the translated MDX file content. No preamble, no commentary, no markdown code fence wrapping the output.

Use natural, professional Russian. Prefer "вы" (formal you) over "ты". Match the friendly-but-precise tone of the original.`;

// Returns 'uncommitted' for untracked/staged-only files; they get re-translated after their first commit.
function getLastCommitSha(absPath: string): string {
  try {
    const out = execFileSync(
      'git',
      ['log', '-n', '1', '--format=%H', '--', absPath],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return out.trim() || 'uncommitted';
  } catch {
    return 'uncommitted';
  }
}

async function* walkMdx(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMdx(full);
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      yield full;
    }
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function existingSourceRev(ruPath: string): Promise<string | null> {
  if (!(await fileExists(ruPath))) return null;
  const text = await readFile(ruPath, 'utf8');
  const parsed = matter(text);
  const translation = parsed.data.translation as
    | { source_rev?: string }
    | undefined;
  return translation?.source_rev ?? null;
}

async function translateOne(enPath: string, ruPath: string) {
  const enText = await readFile(enPath, 'utf8');
  const enSha = getLastCommitSha(enPath);

  const skipSha = await existingSourceRev(ruPath);
  if (skipSha === enSha) {
    console.log(`  SKIP (up-to-date): ${relative(REPO_ROOT, ruPath)}`);
    return;
  }

  console.log(`  TRANSLATE: ${relative(REPO_ROOT, enPath)}`);
  const { text, finishReason } = await generateText({
    model: anthropic(MODEL_ID),
    system: SYSTEM_PROMPT,
    prompt: enText,
    maxOutputTokens: 16000,
  });
  if (finishReason !== 'stop') {
    throw new Error(
      `Translation incomplete (finishReason=${finishReason}) for ${relative(REPO_ROOT, enPath)}`,
    );
  }

  const parsed = matter(text);
  parsed.data.translation = {
    status: 'machine',
    source_rev: enSha,
    translated_at: new Date().toISOString().slice(0, 10),
  };
  const finalText = matter.stringify(parsed.content, parsed.data);

  await mkdir(dirname(ruPath), { recursive: true });
  await writeFile(ruPath, finalText, 'utf8');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required (in .env.local or shell env).');
    process.exit(1);
  }
  console.log(`Translating ${EN_DIR} -> ${RU_DIR}\n`);
  let count = 0;
  let failed = 0;
  for await (const enPath of walkMdx(EN_DIR)) {
    const rel = relative(EN_DIR, enPath);
    const ruPath = join(RU_DIR, rel);
    try {
      await translateOne(enPath, ruPath);
      count += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAILED: ${relative(REPO_ROOT, enPath)}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\nDone — ${count} files translated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
