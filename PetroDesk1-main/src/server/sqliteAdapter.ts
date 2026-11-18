import { DatabaseSync } from 'node:sqlite';

class Statement {
  lastID: number;
  changes: number;

  constructor(lastID: number, changes: number) {
    this.lastID = lastID;
    this.changes = changes;
  }
}

function normalizeParam(v: unknown): string | number | bigint | Uint8Array | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint' || v instanceof Uint8Array) {
    return v;
  }
  return String(v);
}

function bindArgs(stmt: ReturnType<DatabaseSync['prepare']>, params: unknown, mode: 'all' | 'run') {
  if (Array.isArray(params)) {
    const clean = params.map(normalizeParam);
    return mode === 'all' ? stmt.all(...clean) : stmt.run(...clean);
  }
  if (params && typeof params === 'object') {
    const obj: Record<string, string | number | bigint | Uint8Array | null> = {};
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      obj[k] = normalizeParam(v);
    }
    return mode === 'all' ? stmt.all(obj) : stmt.run(obj);
  }
  return mode === 'all' ? stmt.all() : stmt.run();
}

class CompatDatabase {
  private db!: DatabaseSync;
  filename: string;

  constructor(filename: string, _mode?: number, callback?: (err: Error | null) => void) {
    this.filename = filename;
    try {
      this.db = new DatabaseSync(filename);
      if (callback) queueMicrotask(() => callback(null));
    } catch (err) {
      if (callback) queueMicrotask(() => callback(err as Error));
      else throw err;
    }
  }

  serialize(fn: () => void) {
    fn();
  }

  all(sql: string, paramsOrCb?: unknown, maybeCb?: (err: Error | null, rows?: unknown[]) => void) {
    const cb = typeof paramsOrCb === 'function' ? (paramsOrCb as (err: Error | null, rows?: unknown[]) => void) : maybeCb;
    const params = typeof paramsOrCb === 'function' ? [] : paramsOrCb;
    try {
      const stmt = this.db.prepare(sql);
      const rawRows = bindArgs(stmt, params, 'all') as Array<Record<string, unknown>>;
      const rows = rawRows.map((r) => ({ ...r }));
      cb?.(null, rows);
    } catch (err) {
      cb?.(err as Error);
    }
  }

  run(sql: string, paramsOrCb?: unknown, maybeCb?: (this: Statement, err: Error | null) => void) {
    const cb = typeof paramsOrCb === 'function' ? (paramsOrCb as (this: Statement, err: Error | null) => void) : maybeCb;
    const params = typeof paramsOrCb === 'function' ? [] : paramsOrCb;
    try {
      const isEmptyParams =
        (Array.isArray(params) && params.length === 0) ||
        (params && typeof params === 'object' && Object.keys(params).length === 0);

      if (isEmptyParams && sql.trim().split(';').filter((s) => s.trim().length > 0).length > 1) {
        this.db.exec(sql);
        const meta = new Statement(0, 0);
        cb?.call(meta, null);
        return;
      }

      const stmt = this.db.prepare(sql);
      const info = bindArgs(stmt, params, 'run') as { lastInsertRowid: number | bigint; changes: number | bigint };
      const meta = new Statement(Number(info.lastInsertRowid || 0), Number(info.changes || 0));
      cb?.call(meta, null);
    } catch (err) {
      const meta = new Statement(0, 0);
      cb?.call(meta, err as Error);
    }
  }

  close(cb?: (err: Error | null) => void) {
    try {
      this.db.close();
      cb?.(null);
    } catch (err) {
      cb?.(err as Error);
    }
  }
}

export const sqliteDialectModule = {
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  Database: CompatDatabase,
};
