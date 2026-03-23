import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { backupDatabase, pruneBackups, restoreDatabase } from '../backup';

let tmpDir: string;
let sourcePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancstra-backup-test-'));
  sourcePath = path.join(tmpDir, 'source.sqlite');

  // Create a test database with a table and a row
  const db = new Database(sourcePath);
  db.exec('CREATE TABLE test_people (id INTEGER PRIMARY KEY, name TEXT)');
  db.prepare('INSERT INTO test_people (name) VALUES (?)').run('Alice');
  db.close();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('backupDatabase', () => {
  it('creates a valid SQLite backup file', async () => {
    const backupDir = path.join(tmpDir, 'backups');
    const backupPath = await backupDatabase(sourcePath, backupDir);

    expect(fs.existsSync(backupPath)).toBe(true);

    // Verify the backup is a valid SQLite database with our data
    const backupDb = new Database(backupPath, { readonly: true });
    const row = backupDb.prepare('SELECT name FROM test_people WHERE id = 1').get() as { name: string };
    backupDb.close();

    expect(row.name).toBe('Alice');
  });

  it('uses default backup directory when none is provided', async () => {
    // Override HOME to keep test isolated
    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    try {
      const backupPath = await backupDatabase(sourcePath);
      expect(fs.existsSync(backupPath)).toBe(true);
    } finally {
      process.env.HOME = origHome;
    }
  });
});

describe('pruneBackups', () => {
  it('keeps only N most recent backups per base name', async () => {
    const backupDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    // Create 5 backup files with different mtimes by writing them sequentially
    const baseName = 'source';
    const filePaths: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const filePath = path.join(backupDir, `${baseName}.sqlite.2024010${i}T120000Z`);
      fs.writeFileSync(filePath, `backup ${i}`);
      // Set mtime so ordering is deterministic
      const mtime = new Date(2024, 0, i, 12, 0, 0);
      fs.utimesSync(filePath, mtime, mtime);
      filePaths.push(filePath);
    }

    // Keep only 3
    await pruneBackups(backupDir, 3);

    const remaining = fs.readdirSync(backupDir);
    expect(remaining).toHaveLength(3);

    // The 3 most recent (indices 2, 3, 4) should remain
    expect(fs.existsSync(filePaths[0])).toBe(false); // oldest
    expect(fs.existsSync(filePaths[1])).toBe(false); // second oldest
    expect(fs.existsSync(filePaths[2])).toBe(true);
    expect(fs.existsSync(filePaths[3])).toBe(true);
    expect(fs.existsSync(filePaths[4])).toBe(true);
  });
});

describe('restoreDatabase', () => {
  it('restores a valid SQLite backup to the target path', async () => {
    const backupDir = path.join(tmpDir, 'backups');
    const backupPath = await backupDatabase(sourcePath, backupDir);

    const targetPath = path.join(tmpDir, 'restored.sqlite');
    await restoreDatabase(backupPath, targetPath);

    expect(fs.existsSync(targetPath)).toBe(true);

    const restored = new Database(targetPath, { readonly: true });
    const row = restored.prepare('SELECT name FROM test_people WHERE id = 1').get() as { name: string };
    restored.close();

    expect(row.name).toBe('Alice');
  });

  it('rejects non-SQLite files (magic bytes check)', async () => {
    const fakePath = path.join(tmpDir, 'not-a-db.sqlite');
    fs.writeFileSync(fakePath, 'this is definitely not sqlite content at all!!');

    const targetPath = path.join(tmpDir, 'target.sqlite');
    await expect(restoreDatabase(fakePath, targetPath)).rejects.toThrow(
      'Backup file is not a valid SQLite database'
    );

    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
