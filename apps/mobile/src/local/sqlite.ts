// expo-sqlite adapter for the Db interface. One file per user: signing out keeps that person's
// pending uploads, and they continue when the same person signs in again.
import * as SQLite from 'expo-sqlite';

import { migrate, type Db, type SqlValue } from './db';

const fileName = (userId: string) => `user-${userId}.db`;

// One connection per user for the app's lifetime. A second connection to the same file would
// stay open after sign-out and make deleteUserDb fail.
type Connection = { sqlite: SQLite.SQLiteDatabase; db: Db };
const opened = new Map<string, Promise<Connection>>();

async function connect(userId: string): Promise<Connection> {
  const sqlite = await SQLite.openDatabaseAsync(fileName(userId));
  const db: Db = {
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      await sqlite.runAsync(sql, params);
    },
    all: <T>(sql: string, params: SqlValue[] = []) => sqlite.getAllAsync<T>(sql, params),
    get: <T>(sql: string, params: SqlValue[] = []) => sqlite.getFirstAsync<T>(sql, params),
    // ponytail: non-exclusive transaction; switch to withExclusiveTransactionAsync if concurrent writes grow.
    transaction: (fn) => sqlite.withTransactionAsync(fn),
  };
  await migrate(db);
  return { sqlite, db };
}

export async function openUserDb(userId: string): Promise<Db> {
  let connection = opened.get(userId);
  if (!connection) {
    connection = connect(userId);
    opened.set(userId, connection);
    connection.catch(() => opened.delete(userId));
  }
  return (await connection).db;
}

export async function deleteUserDb(userId: string): Promise<void> {
  const connection = opened.get(userId);
  opened.delete(userId);
  if (connection) await connection.then(({ sqlite }) => sqlite.closeAsync(), () => {});
  await SQLite.deleteDatabaseAsync(fileName(userId));
}
