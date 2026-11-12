// The on-device database is the source of truth while offline. Repositories take a Db so the same
// SQL runs on expo-sqlite in the app (./sqlite) and on Node's SQLite in tests (./testDb).
export type SqlValue = string | number | null;

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction(fn: () => Promise<void>): Promise<void>;
}

// One entry per schema version; never edit an entry that has shipped, append a new one.
export const MIGRATIONS = [
  `create table vehicles (
     id text primary key,
     gallery_id text not null,
     make text not null,
     model text not null,
     body_type text not null,
     status text not null,
     details text not null default '{}',
     created_at text not null,
     updated_at text not null
   );
   create table photos (
     id text primary key,
     vehicle_id text not null,
     gallery_id text not null,
     slot text not null,
     local_uri text,
     original_path text,
     captured_at text not null,
     capture text not null default '{}',
     upload_state text not null,
     unique (vehicle_id, slot)
   );
   create table catalog_makes (id integer primary key, name text not null);
   create table catalog_models (id integer primary key, make_id integer not null, name text not null);
   create table outbox (
     id integer primary key autoincrement,
     kind text not null,
     entity_id text not null,
     version integer not null default 1,
     attempts integer not null default 0,
     next_attempt_at integer not null,
     last_error text,
     created_at integer not null,
     unique (kind, entity_id)
   );
   create table meta (key text primary key, value text not null);`,
  `alter table photos add column qc text not null default '{}';`,
];

export async function migrate(db: Db): Promise<void> {
  const row = await db.get<{ user_version: number }>('pragma user_version');
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[version]);
      await db.exec(`pragma user_version = ${version + 1}`);
    });
  }
}
