import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
// @ts-expect-error - wa-sqlite VFS module
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js';
// @ts-expect-error - wa-sqlite VFS module
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';

const DB_NAME = 'kg_extension.db';

let sqlite3: any = null;
let db: number | null = null;

// Serial execution queue to prevent concurrent Asyncify operations.
// The wa-sqlite async build uses Asyncify which corrupts WASM state
// if multiple operations interleave on the same database handle.
let queue: Promise<any> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.then(() => {}, () => {});
  return result;
}

export async function initSQLite(): Promise<void> {
  if (sqlite3 && db !== null) return;

  const module = await SQLiteESMFactory();
  sqlite3 = SQLite.Factory(module);

  // Try OPFS VFS first, fall back to IDB VFS
  try {
    const vfs = new OriginPrivateFileSystemVFS();
    await vfs.isReady;
    sqlite3.vfs_register(vfs, true);
    console.log('[DB] OPFS VFS registered');
  } catch (e) {
    console.warn('[DB] OPFS VFS not available, trying IDB VFS:', e);
    try {
      const vfs = new IDBBatchAtomicVFS();
      await vfs.isReady;
      sqlite3.vfs_register(vfs, true);
      console.log('[DB] IDB VFS registered');
    } catch (e2) {
      console.warn('[DB] IDB VFS not available, using default VFS:', e2);
    }
  }

  db = await sqlite3.open_v2(DB_NAME);

  // Configure pragmas via exec (not serialized — nothing else is running yet)
  await sqlite3.exec(db, 'PRAGMA journal_mode = WAL;');
  await sqlite3.exec(db, 'PRAGMA foreign_keys = ON;');

  console.log('[DB] SQLite initialized');
}

/**
 * Close and reopen the database. Used to recover from corrupted state.
 */
export async function resetDatabase(): Promise<void> {
  if (sqlite3 && db !== null) {
    try {
      await sqlite3.close(db);
    } catch {
      // Ignore close errors
    }
  }
  db = null;
  sqlite3 = null;
  queue = Promise.resolve();
  await initSQLite();
}

/**
 * Execute SQL without returning rows. Supports parameterized queries.
 * All calls are serialized to prevent Asyncify corruption.
 */
export function exec(sql: string, params?: unknown[]): Promise<number> {
  return serialize(async () => {
    if (!sqlite3 || db === null) throw new Error('DB not initialized');

    if (params && params.length > 0) {
      await sqlite3.run(db, sql, params);
    } else {
      await sqlite3.exec(db, sql);
    }

    return sqlite3.changes(db);
  });
}

/**
 * Execute a query and return rows. Supports parameterized queries.
 * All calls are serialized to prevent Asyncify corruption.
 */
export function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  return serialize(async () => {
    if (!sqlite3 || db === null) throw new Error('DB not initialized');

    if (params && params.length > 0) {
      const result = await sqlite3.execWithParams(db, sql, params);
      const { rows, columns } = result;

      return rows.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    } else {
      const results: T[] = [];
      await sqlite3.exec(db, sql, (row: unknown[], columns: string[]) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        results.push(obj as T);
      });
      return results;
    }
  });
}

export function getChanges(): number {
  if (!sqlite3 || db === null) return 0;
  return sqlite3.changes(db);
}

/**
 * Check if a SQLite compile-time module (like fts5) is available
 * by querying the module list pragma.
 */
export function checkModuleAvailable(moduleName: string): Promise<boolean> {
  return serialize(async () => {
    if (!sqlite3 || db === null) return false;
    try {
      const results: string[] = [];
      await sqlite3.exec(
        db,
        `SELECT name FROM pragma_module_list WHERE name = '${moduleName}';`,
        (row: unknown[]) => {
          results.push(row[0] as string);
        }
      );
      return results.length > 0;
    } catch {
      // pragma_module_list might not be available either
      return false;
    }
  });
}
