/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Idempotent SQL Migration Runner (Wave A / GAP-02)
 *
 * Tracks applied DDL migrations in `schema_migrations` using SHA-256 checksums
 * and applies pending `.sql` scripts inside serialized SQL transactions.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SqlExecutor } from './postgresRepositories';

export interface MigrationExecutionReport {
  applied: string[];
  skipped: string[];
  totalDiscovered: number;
}

function sha256Hex(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Strips leading SQL line comments and outer BEGIN;/COMMIT; wrappers when executing inside `withTransaction`,
 * while preserving full checksum calculation over the unmodified migration file.
 */
function sanitizeSqlForNestedTransaction(sql: string): string {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/im, '')
    .replace(/\s*COMMIT\s*;\s*(?=--|$)/im, '\n');
}

export async function runSqlMigrations(
  executor: SqlExecutor,
  migrationsDir = path.resolve(process.cwd(), 'migrations')
): Promise<MigrationExecutionReport> {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  if (!fs.existsSync(migrationsDir)) {
    return { applied: [], skipped: [], totalDiscovered: 0 };
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const existingRes = await executor.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM schema_migrations`
  );
  const existingMap = new Map<string, string>();
  for (const row of existingRes.rows) {
    existingMap.set(row.filename, String(row.checksum).trim());
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of files) {
    const rawSql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const checksum = sha256Hex(rawSql);
    const prevChecksum = existingMap.get(filename);

    if (prevChecksum) {
      if (prevChecksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for ${filename}: recorded=${prevChecksum.slice(0, 12)}..., current=${checksum.slice(0, 12)}...`
        );
      }
      skipped.push(filename);
      continue;
    }

    const executableSql = sanitizeSqlForNestedTransaction(rawSql);
    await executor.withTransaction(async (tx) => {
      await tx.query(executableSql, []);
      await tx.query(
        `INSERT INTO schema_migrations (filename, checksum, applied_at)
         VALUES ($1, $2, NOW())`,
        [filename, checksum]
      );
    });
    applied.push(filename);
  }

  return {
    applied,
    skipped,
    totalDiscovered: files.length,
  };
}
