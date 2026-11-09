// Test-only Db on Node's built-in SQLite, with the same interface as the app's expo-sqlite adapter.
import { DatabaseSync } from 'node:sqlite';

import type { Db, SqlValue } from './db';

const handles = new WeakMap<Db, DatabaseSync>();

export function memoryDb(path = ':memory:'): Db {
  const sqlite = new DatabaseSync(path);
  const db: Db = {
    async exec(sql) {
      sqlite.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      sqlite.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async transaction(fn) {
      sqlite.exec('BEGIN');
      try {
        await fn();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  handles.set(db, sqlite);
  return db;
}

export function closeDb(db: Db): void {
  handles.get(db)?.close();
}
