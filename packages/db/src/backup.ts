import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { createLogger } from '@ancstra/shared';

const log = createLogger('backup');
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');

/**
 * Creates a crash-safe online backup of a SQLite database using better-sqlite3's
 * built-in .backup() API (hot backup — no locks needed).
 *
 * @param sourcePath Absolute path to the source .sqlite file
 * @param backupDir  Directory to write backups into (default: ~/.ancstra/backups/)
 * @returns The absolute path of the newly created backup file
 */
export async function backupDatabase(sourcePath: string, backupDir?: string): Promise<string> {
  const dir = backupDir ?? path.join(os.homedir(), '.ancstra', 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destName = `${baseName}.sqlite.${timestamp}`;
  const destPath = path.join(dir, destName);

  const db = new Database(sourcePath);
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }

  log.info({ sourcePath, destPath }, 'Database backup completed');
  return destPath;
}

/**
 * Deletes old backup files, keeping only the N most recent per base name.
 * Matches files with the pattern *.sqlite.* (e.g. source.sqlite.2024-01-01T...).
 *
 * @param backupDir Directory containing backup files
 * @param keep      Number of most recent backups to retain per base name (default: 7)
 */
export async function pruneBackups(backupDir: string, keep: number = 7): Promise<void> {
  const entries = fs.readdirSync(backupDir);

  // Only consider files matching the *.sqlite.* naming pattern
  const backupFiles = entries.filter((f) => /\.sqlite\..+/.test(f));

  // Group by base name (everything before ".sqlite.")
  const groups = new Map<string, string[]>();
  for (const file of backupFiles) {
    const dotSqliteIdx = file.indexOf('.sqlite.');
    const base = file.slice(0, dotSqliteIdx);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(file);
  }

  for (const [, files] of groups) {
    // Sort by mtime descending (newest first)
    const withStats = files.map((f) => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return { file: f, mtime: stat.mtimeMs };
    });
    withStats.sort((a, b) => b.mtime - a.mtime);

    // Delete all but the `keep` most recent
    const toDelete = withStats.slice(keep);
    for (const { file } of toDelete) {
      const fullPath = path.join(backupDir, file);
      fs.unlinkSync(fullPath);
      log.debug({ fullPath }, 'Pruned old backup');
    }
  }
}

/**
 * Restores a SQLite backup to a target path.
 * Validates the source file's magic bytes before copying.
 *
 * @param backupPath Path to the backup file to restore from
 * @param targetPath Path to write the restored database to
 */
export async function restoreDatabase(backupPath: string, targetPath: string): Promise<void> {
  // Read first 16 bytes and verify SQLite magic header
  const fd = fs.openSync(backupPath, 'r');
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);

  if (!header.equals(SQLITE_MAGIC)) {
    throw new Error('Backup file is not a valid SQLite database');
  }

  fs.copyFileSync(backupPath, targetPath);
  log.info({ backupPath, targetPath }, 'Database restored from backup');
}
