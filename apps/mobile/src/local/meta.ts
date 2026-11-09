// Small key-value store in the user's database, e.g. the cached gallery membership for offline starts.
import type { Db } from './db';

export async function getMeta(db: Db, key: string): Promise<string | null> {
  return (await db.get<{ value: string }>('select value from meta where key = ?', [key]))?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string): Promise<void> {
  await db.run('insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value', [
    key,
    value,
  ]);
}
