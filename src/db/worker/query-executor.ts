import { exec, query } from './sqlite-engine';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      // Retry on SQLITE_BUSY
      if (e.message?.includes('SQLITE_BUSY') || e.message?.includes('database is locked')) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; changes: number }> {
  return withRetry(async () => {
    const rows = await query<T>(sql, params);
    return { rows, changes: 0 };
  });
}

export async function executeExec(
  sql: string,
  params?: unknown[]
): Promise<{ changes: number }> {
  return withRetry(async () => {
    const changes = await exec(sql, params);
    return { changes };
  });
}

export async function executeTransaction(
  statements: Array<{ sql: string; params?: unknown[] }>
): Promise<void> {
  await exec('BEGIN TRANSACTION;');
  try {
    for (const stmt of statements) {
      if (stmt.params && stmt.params.length > 0) {
        await query(stmt.sql, stmt.params);
      } else {
        await exec(stmt.sql);
      }
    }
    await exec('COMMIT;');
  } catch (e) {
    await exec('ROLLBACK;');
    throw e;
  }
}
