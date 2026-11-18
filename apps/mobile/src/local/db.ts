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

// Every adapter runs its transactions one at a time. SQLite has one transaction per connection: a second BEGIN
// while one is open fails, and its ROLLBACK would undo the open one's writes. Nothing calls transaction inside a
// transaction (it would wait for itself forever); keep it that way.
export function oneAtATime(transaction: Db['transaction']): Db['transaction'] {
  let tail: Promise<unknown> = Promise.resolve();
  return (fn) => {
    const run = tail.then(() => transaction(fn));
    tail = run.catch(() => undefined);
    return run;
  };
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
  `alter table vehicles add column variant text;
   alter table vehicles add column first_registration text;
   alter table vehicles add column mileage_km integer;
   alter table vehicles add column fuel text;
   alter table vehicles add column transmission text;
   alter table vehicles add column power_kw integer;
   alter table vehicles add column displacement_ccm integer;
   alter table vehicles add column drive text;
   alter table vehicles add column color_exterior text;
   alter table vehicles add column color_interior text;
   alter table vehicles add column upholstery text;
   alter table vehicles add column previous_owners integer;
   alter table vehicles add column hu_until text;
   alter table vehicles add column accident_free integer;
   alter table vehicles add column service_book integer;
   alter table vehicles add column non_smoker integer;
   alter table vehicles add column vin text;
   alter table vehicles add column damage text not null default '{}';
   alter table vehicles add column damage_checked_at text;
   create table listings (
     id text primary key,
     gallery_id text not null,
     status text not null default 'draft',
     price_eur integer,
     vat_deductible integer,
     warranty_months integer,
     location text,
     created_at text not null,
     updated_at text not null
   );
   create table listing_texts (
     listing_id text not null,
     language text not null,
     titles text not null,
     title text not null,
     description text not null,
     model text not null,
     generated_at text not null,
     edited integer not null default 0,
     updated_at text not null,
     primary key (listing_id, language)
   );`,
  `alter table vehicles add column facts_updated_at text not null default '';
   update vehicles set facts_updated_at = updated_at;
   alter table listings add column facts_updated_at text not null default '';
   update listings set facts_updated_at = updated_at;`,
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
