// Pushes queued local changes to Supabase, then pulls what other devices changed.
import type { Slot } from '../domain/slots';
import { catalogIsEmpty, replaceCatalog } from '../local/catalog';
import type { Db } from '../local/db';
import { cacheListingText, getListing, upsertRemoteListing } from '../local/listings';
import { complete, counts, fail, hasPending, nextDue, pendingCount, type OutboxItem, type OutboxKind } from '../local/outbox';
import { getPhoto, setUploadState, upsertRemotePhoto } from '../local/photos';
import { getVehicle, upsertRemoteVehicle } from '../local/vehicles';
import type { Remote } from './remote';
import type { SyncScheduler } from './scheduler';

export const photoPath = (galleryId: string, vehicleId: string, slot: Slot): string => `${galleryId}/${vehicleId}/${slot}.jpg`;

async function push(db: Db, remote: Remote, item: OutboxItem): Promise<void> {
  if (item.kind === 'vehicle') {
    const vehicle = await getVehicle(db, item.entityId);
    if (vehicle) await remote.upsertVehicle(vehicle);
    await complete(db, item);
    return;
  }

  if (item.kind === 'listing') {
    const listing = await getListing(db, item.entityId);
    if (listing) await remote.upsertListing(listing);
    await complete(db, item);
    return;
  }

  const photo = await getPhoto(db, item.entityId);
  if (!photo?.localUri) {
    await complete(db, item);
    return;
  }
  await setUploadState(db, photo.id, 'uploading');
  const path = photoPath(photo.galleryId, photo.vehicleId, photo.slot);
  // Both calls overwrite: retrying after a failure in between leaves one file and one row.
  await remote.uploadPhoto(path, photo.localUri);
  await remote.upsertPhoto({
    id: photo.id,
    vehicleId: photo.vehicleId,
    galleryId: photo.galleryId,
    slot: photo.slot,
    originalPath: path,
    capturedAt: photo.capturedAt,
    capture: photo.capture,
    qc: photo.qc,
  });
  // Re-shot during the upload: the item stays queued and the new file goes up next.
  await setUploadState(db, photo.id, (await complete(db, item)) ? 'uploaded' : 'pending', path);
}

export async function syncOnce(
  db: Db,
  remote: Remote,
  galleryId: string,
  now: () => number,
  refreshCatalog = false, // the first run of an app start: a filled catalog may miss makes added since
): Promise<{ pushed: number; failed: number; pending: number }> {
  let pushed = 0;
  let failed = 0;
  for (let item = await nextDue(db, now()); item; item = await nextDue(db, now())) {
    try {
      await push(db, remote, item);
      pushed++;
    } catch (error) {
      await fail(db, item.id, error instanceof Error ? error.message : String(error), now());
      if (item.kind === 'photo') await setUploadState(db, item.entityId, 'failed');
      failed++;
    }
  }

  if (refreshCatalog || (await catalogIsEmpty(db))) {
    const { makes, models } = await remote.fetchCatalog();
    await replaceCatalog(db, makes, models);
  }
  // Check and write in one transaction: a local edit cannot land in between and be overwritten.
  const vehicles = await remote.fetchVehicles(galleryId);
  await db.transaction(async () => {
    for (const vehicle of vehicles) if (!(await hasPending(db, 'vehicle', vehicle.id))) await upsertRemoteVehicle(db, vehicle);
  });
  const listings = await remote.fetchListings(galleryId);
  await db.transaction(async () => {
    for (const listing of listings) if (!(await hasPending(db, 'listing', listing.id))) await upsertRemoteListing(db, listing);
  });
  for (const text of await remote.fetchListingTexts(galleryId)) await cacheListingText(db, text);
  for (const photo of await remote.fetchPhotos(galleryId)) await upsertRemotePhoto(db, photo);

  return { pushed, failed, pending: await pendingCount(db) };
}

// One scheduled run. Offline nothing is attempted, so the outbox does not build up backoff it would
// have to wait out later. The counts come back even when the server cannot be reached: the screens
// show what still waits, and the 30 s retry only runs while something waits.
export async function syncAndCount(
  db: Db,
  remote: Remote,
  galleryId: string,
  now: () => number,
  online: boolean,
  refreshCatalog = false,
): Promise<{ pending: number; failed: number }> {
  if (online) await syncOnce(db, remote, galleryId, now, refreshCatalog).catch(() => {});
  return counts(db);
}

// Syncs now and says whether none of the given entities is left in the outbox, so a caller can go on
// to the server (generate a text, read a report) knowing it sees the latest local changes.
export async function flush(
  db: Db,
  scheduler: Pick<SyncScheduler, 'request' | 'idle'>,
  entities: { kind: OutboxKind; id: string }[],
): Promise<boolean> {
  scheduler.request();
  await scheduler.idle();
  for (const { kind, id } of entities) if (await hasPending(db, kind, id)) return false;
  return true;
}
