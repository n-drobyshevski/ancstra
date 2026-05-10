import type { Client, InStatement, InArgs, ResultSet, TransactionMode } from '@libsql/client';
import { createLogger } from '@ancstra/shared';

const log = createLogger('db.perf');

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 50);
const MAX_SQL_LENGTH = 500;

/**
 * Extract the SQL string from an InStatement (which may be a plain string or
 * an object with a `sql` property).
 */
function extractSql(stmt: InStatement): string {
  if (typeof stmt === 'string') return stmt.slice(0, MAX_SQL_LENGTH);
  return stmt.sql.slice(0, MAX_SQL_LENGTH);
}

/**
 * Count the number of parameters in an InArgs value.
 */
function countParams(args: InArgs | undefined): number {
  if (!args) return 0;
  if (Array.isArray(args)) return args.length;
  return Object.keys(args).length;
}

/**
 * Wrap a libsql Client with a Proxy that measures the wall-clock time of
 * `execute` and `batch` calls and emits a warn log when the threshold is
 * exceeded.
 *
 * Only active in production (NODE_ENV=production) or when
 * PERF_SLOW_QUERY_ENABLED=1 — callers in packages/db/src/index.ts gate this.
 *
 * The returned object preserves the full Client type so Drizzle is unaffected.
 */
export function wrapWithSlowQueryLogger(client: Client): Client {
  return new Proxy(client, {
    get(target, prop, receiver) {
      // Intercept execute
      if (prop === 'execute') {
        return async function execute(
          stmtOrSql: InStatement | string,
          args?: InArgs,
        ): Promise<ResultSet> {
          const start = performance.now();
          // The real Client.execute has two overloads; forward correctly.
          const result =
            args !== undefined
              ? await target.execute(stmtOrSql as string, args)
              : await target.execute(stmtOrSql as InStatement);
          const ms = performance.now() - start;
          if (ms > SLOW_QUERY_THRESHOLD_MS) {
            const sql = typeof stmtOrSql === 'string'
              ? stmtOrSql.slice(0, MAX_SQL_LENGTH)
              : extractSql(stmtOrSql as InStatement);
            const params_count =
              args !== undefined ? countParams(args) : countParams((stmtOrSql as { args?: InArgs }).args);
            log.warn(
              { category: 'db.slow_query', sql, ms: Math.round(ms), params_count },
              'slow query',
            );
          }
          return result;
        };
      }

      // Intercept batch
      if (prop === 'batch') {
        return async function batch(
          stmts: Array<InStatement | [string, InArgs?]>,
          mode?: TransactionMode,
        ): Promise<Array<ResultSet>> {
          const start = performance.now();
          const result = await target.batch(stmts, mode);
          const ms = performance.now() - start;
          if (ms > SLOW_QUERY_THRESHOLD_MS) {
            // For batches we log a summary — individual SQLs are not logged
            // to avoid log explosion.
            log.warn(
              {
                category: 'db.slow_query',
                sql: `[batch of ${stmts.length} statements]`,
                ms: Math.round(ms),
                params_count: stmts.length,
              },
              'slow query',
            );
          }
          return result;
        };
      }

      // All other properties (transaction, migrate, close, closed, protocol, …)
      // pass through unchanged.
      return Reflect.get(target, prop, receiver);
    },
  });
}
