// Changes waiting to be pushed to Supabase, oldest first. One item per entity; the push reads the
// entity's current local row, so a later change only bumps the item's version.
import type { Db } from './db';

export type OutboxKind = 'vehicle' | 'photo';
export type OutboxItem = {
  id: number;
  kind: OutboxKind;
  entityId: string;
  version: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
};

type Row = {
  id: number;
  kind: OutboxKind;
  entity_id: string;
  version: number;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
};

const toItem = (r: Row): OutboxItem => ({
  id: r.id,
  kind: r.kind,
  entityId: r.entity_id,
  version: r.version,
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  lastError: r.last_error,
});

export async function enqueue(db: Db, kind: OutboxKind, entityId: string, now: number): Promise<void> {
  await db.run(
    `insert into outbox (kind, entity_id, next_attempt_at, created_at) values (?, ?, ?, ?)
     on conflict (kind, entity_id) do update set version = version + 1`,
    [kind, entityId, now, now],
  );
}

export async function nextDue(db: Db, now: number): Promise<OutboxItem | null> {
  const row = await db.get<Row>('select * from outbox where next_attempt_at <= ? order by id limit 1', [now]);
  return row ? toItem(row) : null;
}

// Removes the item only if nothing changed since it was picked; returns whether it was removed.
// A change during the push (for example a re-shot photo) keeps the item for another push.
export async function complete(db: Db, item: OutboxItem): Promise<boolean> {
  await db.run('delete from outbox where id = ? and version = ?', [item.id, item.version]);
  return (await db.get('select 1 from outbox where id = ?', [item.id])) === null;
}

export const backoffMs = (attempts: number): number => Math.min(5000 * 2 ** (attempts - 1), 600_000);

export async function fail(db: Db, id: number, error: string, now: number): Promise<void> {
  const row = await db.get<{ attempts: number }>('select attempts from outbox where id = ?', [id]);
  if (!row) return;
  const attempts = row.attempts + 1;
  await db.run('update outbox set attempts = ?, next_attempt_at = ?, last_error = ? where id = ?', [
    attempts,
    now + backoffMs(attempts),
    error,
    id,
  ]);
}

export async function pendingCount(db: Db): Promise<number> {
  return (await db.get<{ n: number }>('select count(*) as n from outbox'))?.n ?? 0;
}

// Items not tried yet count as pending, items that failed at least once as failed.
export async function counts(db: Db): Promise<{ pending: number; failed: number }> {
  const row = await db.get<{ pending: number | null; failed: number | null }>(
    'select sum(attempts = 0) as pending, sum(attempts > 0) as failed from outbox',
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
}

export async function hasPending(db: Db, kind: OutboxKind, entityId: string): Promise<boolean> {
  return (await db.get('select 1 from outbox where kind = ? and entity_id = ?', [kind, entityId])) !== null;
}
