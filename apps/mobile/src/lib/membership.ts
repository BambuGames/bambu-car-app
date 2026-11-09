// The gallery a person works for, cached in the user's database so the app also starts offline.
import type { Db } from '../local/db';
import { getMeta, setMeta } from '../local/meta';

export type Membership = { galleryId: string; galleryName: string; role: 'owner' | 'staff' };

// undefined: this device has never had an answer from the server. null: the server said "no gallery".
export async function cachedMembership(db: Db): Promise<Membership | null | undefined> {
  const cached = await getMeta(db, 'membership');
  return cached === null ? undefined : (JSON.parse(cached) as Membership | null);
}

// Asks the server and caches its answer. If the server cannot be reached the cached answer stays, and
// with nothing cached the membership stays unknown, which must not be shown as "no gallery".
export async function refreshMembership(
  db: Db,
  read: () => Promise<Membership | null>,
): Promise<Membership | null | undefined> {
  try {
    const membership = await read();
    await setMeta(db, 'membership', JSON.stringify(membership));
    return membership;
  } catch {
    return cachedMembership(db);
  }
}
