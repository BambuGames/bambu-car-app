// Offline copy of the make and model list, refreshed from the server.
import type { Db } from './db';

export type Make = { id: number; name: string };
export type Model = { id: number; makeId: number; name: string };

export async function replaceCatalog(db: Db, makes: Make[], models: Model[]): Promise<void> {
  await db.transaction(async () => {
    await db.run('delete from catalog_models');
    await db.run('delete from catalog_makes');
    for (const m of makes) await db.run('insert into catalog_makes (id, name) values (?, ?)', [m.id, m.name]);
    for (const m of models) {
      await db.run('insert into catalog_models (id, make_id, name) values (?, ?, ?)', [m.id, m.makeId, m.name]);
    }
  });
}

// Case-insensitive substring match (SQLite LIKE), first 50 results.
export function searchMakes(db: Db, query: string): Promise<Make[]> {
  return db.all<Make>('select id, name from catalog_makes where name like ? order by name limit 50', [`%${query}%`]);
}

export function searchModels(db: Db, makeId: number, query: string): Promise<Model[]> {
  return db.all<Model>(
    'select id, make_id as makeId, name from catalog_models where make_id = ? and name like ? order by name limit 50',
    [makeId, `%${query}%`],
  );
}

export async function catalogIsEmpty(db: Db): Promise<boolean> {
  return ((await db.get<{ n: number }>('select count(*) as n from catalog_makes'))?.n ?? 0) === 0;
}
