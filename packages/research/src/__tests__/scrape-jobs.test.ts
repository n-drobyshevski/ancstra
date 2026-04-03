import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {
  createScrapeJob,
  getScrapeJob,
  updateScrapeJob,
  findActiveScrapeJob,
  deleteStaleJobs,
} from '../items/scrape-jobs';

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite);

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      publication_date TEXT,
      repository_name TEXT,
      repository_url TEXT,
      source_type TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      citation_detail TEXT,
      citation_text TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      event_id TEXT,
      family_id TEXT,
      person_name_id TEXT,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE search_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      base_url TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT,
      rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
      health_status TEXT NOT NULL DEFAULT 'unknown',
      last_health_check TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE research_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT,
      snippet TEXT,
      full_text TEXT,
      notes TEXT,
      archived_html_path TEXT,
      screenshot_path TEXT,
      archived_at TEXT,
      provider_id TEXT REFERENCES search_providers(id),
      provider_record_id TEXT,
      discovery_method TEXT NOT NULL,
      search_query TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      promoted_source_id TEXT REFERENCES sources(id),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE research_item_persons (
      research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (research_item_id, person_id)
    );
    CREATE TABLE scrape_jobs (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES research_items(id),
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      full_text TEXT,
      title TEXT,
      snippet TEXT,
      error TEXT,
      method TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX idx_scrape_jobs_item ON scrape_jobs (item_id);
    CREATE INDEX idx_scrape_jobs_status ON scrape_jobs (status);
  `);

  // Seed test user and research item via raw SQL (FK required for scrape_jobs.item_id)
  const now = new Date().toISOString();
  sqlite.prepare(
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run('test-user-1', 'test@ancstra.app', '$2a$10$fakehash', 'Test User', now, now);
  sqlite.prepare(
    `INSERT INTO research_items (id, title, discovery_method, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('item-1', 'Test Research Item', 'search', 'draft', 'test-user-1', now, now);
});

afterEach(() => {
  sqlite.close();
});

describe('createScrapeJob', () => {
  it('creates a scrape job with pending status', async () => {
    const result = await createScrapeJob(db as any, {
      id: 'job-1',
      itemId: 'item-1',
      url: 'https://example.com/record',
      method: 'playwright',
    });

    expect(result.id).toBe('job-1');
    expect(result.status).toBe('pending');
    expect(result.createdAt).toBeDefined();
  });

  it('persists the job to the database', async () => {
    await createScrapeJob(db as any, {
      id: 'job-2',
      itemId: 'item-1',
      url: 'https://example.com/record2',
      method: 'fetch_fallback',
    });

    const job = await getScrapeJob(db as any, 'job-2');
    expect(job).not.toBeNull();
    expect(job!.url).toBe('https://example.com/record2');
    expect(job!.method).toBe('fetch_fallback');
  });
});

describe('getScrapeJob', () => {
  it('returns null for a nonexistent job id', async () => {
    const job = await getScrapeJob(db as any, 'nonexistent-id');
    expect(job).toBeNull();
  });

  it('returns the job by id', async () => {
    await createScrapeJob(db as any, {
      id: 'job-3',
      itemId: 'item-1',
      url: 'https://example.com/record3',
      method: 'playwright',
    });

    const job = await getScrapeJob(db as any, 'job-3');
    expect(job).not.toBeNull();
    expect(job!.id).toBe('job-3');
    expect(job!.itemId).toBe('item-1');
    expect(job!.status).toBe('pending');
  });
});

describe('updateScrapeJob', () => {
  it('updates status and content fields', async () => {
    await createScrapeJob(db as any, {
      id: 'job-4',
      itemId: 'item-1',
      url: 'https://example.com/record4',
      method: 'playwright',
    });

    const completedAt = new Date().toISOString();
    await updateScrapeJob(db as any, 'job-4', {
      status: 'completed',
      fullText: 'Full page content here',
      title: 'Extracted Page Title',
      snippet: 'A brief snippet',
      completedAt,
    });

    const job = await getScrapeJob(db as any, 'job-4');
    expect(job!.status).toBe('completed');
    expect(job!.fullText).toBe('Full page content here');
    expect(job!.title).toBe('Extracted Page Title');
    expect(job!.snippet).toBe('A brief snippet');
    expect(job!.completedAt).toBe(completedAt);
  });

  it('updates error field on failure', async () => {
    await createScrapeJob(db as any, {
      id: 'job-5',
      itemId: 'item-1',
      url: 'https://example.com/record5',
      method: 'playwright',
    });

    await updateScrapeJob(db as any, 'job-5', {
      status: 'failed',
      error: 'Network timeout',
      completedAt: new Date().toISOString(),
    });

    const job = await getScrapeJob(db as any, 'job-5');
    expect(job!.status).toBe('failed');
    expect(job!.error).toBe('Network timeout');
  });
});

describe('findActiveScrapeJob', () => {
  it('returns null when no active job exists for the item', async () => {
    const job = await findActiveScrapeJob(db as any, 'item-1');
    expect(job).toBeNull();
  });

  it('returns a pending job for the item', async () => {
    await createScrapeJob(db as any, {
      id: 'job-6',
      itemId: 'item-1',
      url: 'https://example.com/record6',
      method: 'playwright',
    });

    const job = await findActiveScrapeJob(db as any, 'item-1');
    expect(job).not.toBeNull();
    expect(job!.id).toBe('job-6');
    expect(job!.status).toBe('pending');
  });

  it('returns a processing job for the item', async () => {
    await createScrapeJob(db as any, {
      id: 'job-7',
      itemId: 'item-1',
      url: 'https://example.com/record7',
      method: 'playwright',
    });
    await updateScrapeJob(db as any, 'job-7', { status: 'processing' });

    const job = await findActiveScrapeJob(db as any, 'item-1');
    expect(job).not.toBeNull();
    expect(job!.status).toBe('processing');
  });

  it('ignores completed jobs', async () => {
    await createScrapeJob(db as any, {
      id: 'job-8',
      itemId: 'item-1',
      url: 'https://example.com/record8',
      method: 'playwright',
    });
    await updateScrapeJob(db as any, 'job-8', {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    const job = await findActiveScrapeJob(db as any, 'item-1');
    expect(job).toBeNull();
  });

  it('ignores failed jobs', async () => {
    await createScrapeJob(db as any, {
      id: 'job-9',
      itemId: 'item-1',
      url: 'https://example.com/record9',
      method: 'playwright',
    });
    await updateScrapeJob(db as any, 'job-9', {
      status: 'failed',
      error: 'Timeout',
      completedAt: new Date().toISOString(),
    });

    const job = await findActiveScrapeJob(db as any, 'item-1');
    expect(job).toBeNull();
  });
});

describe('deleteStaleJobs', () => {
  it('deletes completed jobs older than N days', async () => {
    const oldDate = new Date(Date.now() - 8 * 86400_000).toISOString();

    // Insert directly via raw SQL to control timestamps
    sqlite.prepare(
      `INSERT INTO scrape_jobs (id, item_id, url, status, method, created_at, completed_at)
       VALUES (?, 'item-1', 'https://example.com/old', 'completed', 'playwright', ?, ?)`
    ).run('old-completed', oldDate, oldDate);

    await deleteStaleJobs(db as any, 7);

    const job = await getScrapeJob(db as any, 'old-completed');
    expect(job).toBeNull();
  });

  it('deletes failed jobs older than N days', async () => {
    const oldDate = new Date(Date.now() - 8 * 86400_000).toISOString();

    sqlite.prepare(
      `INSERT INTO scrape_jobs (id, item_id, url, status, method, created_at, completed_at)
       VALUES (?, 'item-1', 'https://example.com/old-failed', 'failed', 'playwright', ?, ?)`
    ).run('old-failed', oldDate, oldDate);

    await deleteStaleJobs(db as any, 7);

    const job = await getScrapeJob(db as any, 'old-failed');
    expect(job).toBeNull();
  });

  it('deletes zombie pending jobs older than N days', async () => {
    const oldDate = new Date(Date.now() - 8 * 86400_000).toISOString();

    sqlite.prepare(
      `INSERT INTO scrape_jobs (id, item_id, url, status, method, created_at)
       VALUES (?, 'item-1', 'https://example.com/zombie', 'pending', 'playwright', ?)`
    ).run('zombie-pending', oldDate);

    await deleteStaleJobs(db as any, 7);

    const job = await getScrapeJob(db as any, 'zombie-pending');
    expect(job).toBeNull();
  });

  it('preserves recent completed jobs', async () => {
    const recentDate = new Date(Date.now() - 2 * 86400_000).toISOString();

    sqlite.prepare(
      `INSERT INTO scrape_jobs (id, item_id, url, status, method, created_at, completed_at)
       VALUES (?, 'item-1', 'https://example.com/recent', 'completed', 'playwright', ?, ?)`
    ).run('recent-completed', recentDate, recentDate);

    await deleteStaleJobs(db as any, 7);

    const job = await getScrapeJob(db as any, 'recent-completed');
    expect(job).not.toBeNull();
  });

  it('preserves recent pending jobs', async () => {
    await createScrapeJob(db as any, {
      id: 'recent-pending',
      itemId: 'item-1',
      url: 'https://example.com/recent-pending',
      method: 'playwright',
    });

    await deleteStaleJobs(db as any, 7);

    const job = await getScrapeJob(db as any, 'recent-pending');
    expect(job).not.toBeNull();
  });
});
