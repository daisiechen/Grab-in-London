import pg from 'pg';

/**
 * Pool factory. int8 stays a string (node-postgres default) so versions/seqs never lose precision;
 * statement_timeout bounds DB work separately from HTTP timeouts.
 */
export function createPool(connectionString: string, options: { max?: number; statementTimeoutMs?: number; application?: string } = {}): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    statement_timeout: options.statementTimeoutMs ?? 10_000,
    application_name: options.application ?? 'fancy',
  });
}

export type { Pool, PoolClient } from 'pg';
