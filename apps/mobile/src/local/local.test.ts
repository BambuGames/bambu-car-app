import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MIGRATIONS, migrate, type Db } from './db';
import { backoffMs, complete, enqueue, fail, nextDue, pendingCount } from './outbox';
import { listPhotos, savePhoto } from './photos';
import { closeDb, memoryDb } from './testDb';
import { createVehicle, getVehicle, listVehicles } from './vehicles';

const NOW = '2026-11-09T10:00:00.000Z';
let db: Db;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
});
afterEach(() => closeDb(db));

const passat = (id = 'v1') =>
  createVehicle(db, { id, galleryId: 'g1', make: 'Volkswagen', model: 'Passat', bodyType: 'kombi', now: NOW });

const photo = (
  slot: Parameters<typeof savePhoto>[1]['slot'],
  id: string,
  localUri = `file:///${id}.jpg`,
  qc: Record<string, unknown> = {},
) =>
  savePhoto(db, { id, vehicleId: 'v1', galleryId: 'g1', slot, localUri, capturedAt: '2026-11-09T10:01:00.000Z', capture: {}, qc });

test('savePhoto stores qc and returns the replaced file uri', async () => {
  await passat();
  const first = await photo('front', 'p1', 'file:///a.jpg', { issues: ['dark'], accepted: false });
  const second = await photo('front', 'p2', 'file:///b.jpg', { issues: [], accepted: false });
  expect(first.replacedUri).toBeNull();
  expect(second.replacedUri).toBe('file:///a.jpg');
  expect((await listPhotos(db, 'v1'))[0].qc).toEqual({ issues: [], accepted: false });
});

test('migrate adds qc to a version 1 database', async () => {
  const old = memoryDb();
  await old.exec(MIGRATIONS[0]);
  await old.exec('pragma user_version = 1');
  await old.run(
    `insert into photos (id, vehicle_id, gallery_id, slot, local_uri, original_path, captured_at, upload_state)
     values ('p1', 'v1', 'g1', 'front', 'file:///a.jpg', null, '2026-11-09T10:01:00.000Z', 'pending')`,
  );
  await migrate(old);
  expect((await listPhotos(old, 'v1'))[0].qc).toEqual({});
  closeDb(old);
});

test('createVehicle stores a draft vehicle and queues it for upload', async () => {
  const v = await passat();
  expect(v.status).toBe('draft');
  expect(await nextDue(db, Date.parse(NOW))).toMatchObject({ kind: 'vehicle', entityId: 'v1' });
});

test('savePhoto replaces the photo of the same slot and keeps one row', async () => {
  await passat();
  const first = await photo('front', 'p1', 'file:///a.jpg');
  const second = await photo('front', 'p2', 'file:///b.jpg');
  expect(second.photoId).toBe(first.photoId);
  expect((await listPhotos(db, 'v1')).map((p) => p.localUri)).toEqual(['file:///b.jpg']);
});

test('savePhoto moves a draft vehicle to shooting', async () => {
  await passat();
  await photo('front', 'p1');
  expect((await getVehicle(db, 'v1'))?.status).toBe('shooting');
});

test('listVehicles counts captured exterior slots and pending uploads', async () => {
  await passat();
  await photo('front', 'p1');
  await photo('left', 'p2');
  await photo('detail_wheel', 'p3');
  const [item] = await listVehicles(db, 'g1');
  expect(item).toMatchObject({ id: 'v1', exteriorDone: 2, pendingUploads: 3 });
});

test('outbox returns items in insertion order and skips ones waiting for retry', async () => {
  await enqueue(db, 'vehicle', 'v1', 0);
  await enqueue(db, 'photo', 'p1', 0);
  const first = await nextDue(db, 0);
  await fail(db, first!.id, 'offline', 0);
  expect(await nextDue(db, 1000)).toMatchObject({ kind: 'photo', entityId: 'p1' });
});

test('fail backs off 5s, 10s, 20s and caps at 10 minutes', () => {
  expect([1, 2, 3, 10].map(backoffMs)).toEqual([5000, 10000, 20000, 600000]);
});

test('enqueue keeps one pending item per entity', async () => {
  await enqueue(db, 'vehicle', 'v1', 0);
  await enqueue(db, 'vehicle', 'v1', 0);
  expect(await pendingCount(db)).toBe(1);
});

test('a change while an item is being pushed keeps it queued', async () => {
  await enqueue(db, 'photo', 'p1', 0);
  const picked = await nextDue(db, 0);
  await enqueue(db, 'photo', 'p1', 0); // re-shot during the upload
  expect(await complete(db, picked!)).toBe(false);
  expect(await pendingCount(db)).toBe(1);
});

test('pending outbox items survive reopening the database', async () => {
  const file = join(tmpdir(), `local-test-${Date.now()}.db`);
  const onDisk = memoryDb(file);
  await migrate(onDisk);
  await createVehicle(onDisk, { id: 'v1', galleryId: 'g1', make: 'BMW', model: '320d', bodyType: 'sedan', now: NOW });
  closeDb(onDisk);

  const reopened = memoryDb(file);
  await migrate(reopened);
  expect(await pendingCount(reopened)).toBe(1);
  closeDb(reopened);
});
