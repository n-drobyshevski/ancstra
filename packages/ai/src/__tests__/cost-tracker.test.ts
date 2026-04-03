import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { sql } from 'drizzle-orm';
import { calculateCost, checkBudget, recordUsage, getUsageStats } from '../context/cost-tracker';

function createTestDb() {
  const raw = new Database(':memory:');
  raw.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
    VALUES ('user1', 'Test', 'test@test.com', 'hash', '2025-01-01', '2025-01-01');

    CREATE TABLE ai_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      task_type TEXT NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_ai_usage_user_month ON ai_usage(user_id, created_at);
  `);
  return drizzle({ client: raw, schema });
}

describe('calculateCost', () => {
  it('calculates Sonnet cost correctly', () => {
    const cost = calculateCost('claude-sonnet-4-6', 1000, 500);
    // (1000 * 3.00 + 500 * 15.00) / 1_000_000 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it('calculates Haiku cost correctly', () => {
    const cost = calculateCost('claude-haiku-4-5', 1000, 500);
    // (1000 * 0.80 + 500 * 4.00) / 1_000_000 = 0.0028
    expect(cost).toBeCloseTo(0.0028, 4);
  });

  it('calculates Opus cost correctly', () => {
    const cost = calculateCost('claude-opus-4-6', 1000, 500);
    // (1000 * 15.00 + 500 * 75.00) / 1_000_000 = 0.0525
    expect(cost).toBeCloseTo(0.0525, 4);
  });

  it('returns 0 for unknown model', () => {
    expect(calculateCost('unknown-model', 1000, 500)).toBe(0);
  });
});

describe('checkBudget', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns spent amount for current month', async () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15T00:00:00.000Z`;

    db.run(sql`
      INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, created_at)
      VALUES ('u1', 'user1', 'claude-sonnet-4-6', 1000, 500, 0.0105, 'chat', ${thisMonth})
    `);
    db.run(sql`
      INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, created_at)
      VALUES ('u2', 'user1', 'claude-sonnet-4-6', 2000, 1000, 0.021, 'chat', ${thisMonth})
    `);

    const result = await checkBudget(db, 10);
    expect(result.spent).toBeCloseTo(0.03, 2);
    expect(result.remaining).toBeLessThan(10);
    expect(result.overBudget).toBe(false);
  });

  it('detects over-budget condition', async () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10T00:00:00.000Z`;

    db.run(sql`
      INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, created_at)
      VALUES ('u3', 'user1', 'claude-opus-4-6', 100000, 50000, 12.50, 'chat', ${thisMonth})
    `);

    const result = await checkBudget(db, 10);
    expect(result.overBudget).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('excludes previous month usage', async () => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const prevMonth = prev.toISOString();

    db.run(sql`
      INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, created_at)
      VALUES ('u4', 'user1', 'claude-sonnet-4-6', 5000, 2000, 5.00, 'chat', ${prevMonth})
    `);

    const result = await checkBudget(db, 10);
    expect(result.spent).toBe(0);
  });
});

describe('recordUsage', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts a usage record with calculated cost', async () => {
    await recordUsage(db, {
      userId: 'user1',
      model: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 500,
      taskType: 'chat',
    });

    const rows = db.all<{ cost_usd: number; model: string }>(
      sql`SELECT cost_usd, model FROM ai_usage`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].cost_usd).toBeCloseTo(0.0105, 4);
    expect(rows[0].model).toBe('claude-sonnet-4-6');
  });
});

describe('getUsageStats', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('aggregates usage by model for current month', async () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15T00:00:00.000Z`;

    db.run(sql`
      INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, created_at)
      VALUES ('s1', 'user1', 'claude-sonnet-4-6', 1000, 500, 0.0105, 'chat', ${thisMonth})
    `);
    db.run(sql`
      INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, created_at)
      VALUES ('s2', 'user1', 'claude-haiku-4-5', 2000, 1000, 0.0056, 'extraction', ${thisMonth})
    `);

    const stats = await getUsageStats(db, 'user1');
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalCost).toBeGreaterThan(0);
    expect(stats.byModel['claude-sonnet-4-6']).toBeDefined();
    expect(stats.byModel['claude-haiku-4-5']).toBeDefined();
  });
});
