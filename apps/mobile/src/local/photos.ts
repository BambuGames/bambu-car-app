import type { Slot } from '../domain/slots';
import type { Db } from './db';
import { enqueue } from './outbox';

export type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'remote';

export type PhotoRow = {
  id: string;
  vehicleId: string;
  galleryId: string;
  slot: Slot;
  localUri: string | null;
  originalPath: string | null;
  capturedAt: string;
  capture: Record<string, unknown>;
  uploadState: UploadState;
};

// A photo as stored on the server, possibly taken on another device.
export type RemotePhoto = {
  id: string;
  vehicleId: string;
  galleryId: string;
  slot: Slot;
  originalPath: string;
  capturedAt: string;
};

type Row = {
  id: string;
  vehicle_id: string;
  gallery_id: string;
  slot: Slot;
  local_uri: string | null;
  original_path: string | null;
  captured_at: string;
  capture: string;
  upload_state: UploadState;
};

const toPhoto = (r: Row): PhotoRow => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  galleryId: r.gallery_id,
  slot: r.slot,
  localUri: r.local_uri,
  originalPath: r.original_path,
  capturedAt: r.captured_at,
  capture: JSON.parse(r.capture),
  uploadState: r.upload_state,
});

// One photo per step: a re-shot replaces the file and keeps the step's photo id.
export async function savePhoto(
  db: Db,
  input: {
    id: string;
    vehicleId: string;
    galleryId: string;
    slot: Slot;
    localUri: string;
    capturedAt: string;
    capture: Record<string, unknown>;
  },
): Promise<{ photoId: string }> {
  let photoId = input.id;
  const now = Date.parse(input.capturedAt);
  await db.transaction(async () => {
    const existing = await db.get<{ id: string }>('select id from photos where vehicle_id = ? and slot = ?', [
      input.vehicleId,
      input.slot,
    ]);
    photoId = existing?.id ?? input.id;
    await db.run(
      `insert into photos (id, vehicle_id, gallery_id, slot, local_uri, original_path, captured_at, capture, upload_state)
       values (?, ?, ?, ?, ?, null, ?, ?, 'pending')
       on conflict (id) do update set local_uri = excluded.local_uri, captured_at = excluded.captured_at,
         capture = excluded.capture, upload_state = 'pending'`,
      [photoId, input.vehicleId, input.galleryId, input.slot, input.localUri, input.capturedAt, JSON.stringify(input.capture)],
    );
    const vehicle = await db.get<{ status: string }>('select status from vehicles where id = ?', [input.vehicleId]);
    if (vehicle?.status === 'draft') {
      await db.run(`update vehicles set status = 'shooting', updated_at = ? where id = ?`, [input.capturedAt, input.vehicleId]);
      await enqueue(db, 'vehicle', input.vehicleId, now);
    }
    await enqueue(db, 'photo', photoId, now);
  });
  return { photoId };
}

export async function listPhotos(db: Db, vehicleId: string): Promise<PhotoRow[]> {
  return (await db.all<Row>('select * from photos where vehicle_id = ? order by rowid', [vehicleId])).map(toPhoto);
}

export async function getPhoto(db: Db, id: string): Promise<PhotoRow | null> {
  const row = await db.get<Row>('select * from photos where id = ?', [id]);
  return row ? toPhoto(row) : null;
}

export async function setUploadState(db: Db, photoId: string, state: UploadState, originalPath?: string): Promise<void> {
  await db.run('update photos set upload_state = ?, original_path = coalesce(?, original_path) where id = ?', [
    state,
    originalPath ?? null,
    photoId,
  ]);
}

// Writes a photo pulled from the server. A photo still waiting to upload on this device wins,
// and this device's own uploaded photo keeps its local file.
export async function upsertRemotePhoto(db: Db, p: RemotePhoto): Promise<void> {
  const existing = await db.get<{ id: string; upload_state: UploadState }>(
    'select id, upload_state from photos where vehicle_id = ? and slot = ?',
    [p.vehicleId, p.slot],
  );
  if (!existing) {
    await db.run(
      `insert into photos (id, vehicle_id, gallery_id, slot, local_uri, original_path, captured_at, upload_state)
       values (?, ?, ?, ?, null, ?, ?, 'remote')`,
      [p.id, p.vehicleId, p.galleryId, p.slot, p.originalPath, p.capturedAt],
    );
    return;
  }
  if (['pending', 'uploading', 'failed'].includes(existing.upload_state)) return;
  if (existing.id === p.id && existing.upload_state === 'uploaded') return;
  await db.run(
    `update photos set id = ?, local_uri = null, original_path = ?, captured_at = ?, upload_state = 'remote'
     where vehicle_id = ? and slot = ?`,
    [p.id, p.originalPath, p.capturedAt, p.vehicleId, p.slot],
  );
}
