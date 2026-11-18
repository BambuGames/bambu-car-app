import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MIGRATIONS, migrate, type Db } from './db';
import { backoffMs, complete, enqueue, fail, nextDue, pendingCount } from './outbox';
import { getListing, saveListing } from './listings';
import { listPhotos, savePhoto } from './photos';
import { closeDb, memoryDb } from './testDb';
import { createVehicle, getVehicle, listVehicles, updateVehicle } from './vehicles';

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

test('updateVehicle merges data and queues the vehicle once', async () => {
  await passat();
  await updateVehicle(db, 'v1', { data: { fuel: 'diesel' } as never }, NOW);
  const v = await updateVehicle(db, 'v1', { data: { mileageKm: 120000 } as never, details: { notes: 'x' } }, '2026-11-10T10:00:00.000Z');
  expect(v.data).toMatchObject({ fuel: 'diesel', mileageKm: 120000, vin: null });
  expect(v.updatedAt).toBe('2026-11-10T10:00:00.000Z');
  expect((await getVehicle(db, 'v1'))?.data.fuel).toBe('diesel');
  expect(await db.all("select * from outbox where kind = 'vehicle'")).toHaveLength(1);
});

test('updateVehicle rejects an invalid value and writes nothing', async () => {
  await passat();
  await expect(updateVehicle(db, 'v1', { data: { mileageKm: -1 } as never }, NOW)).rejects.toThrow('invalid');
  expect((await getVehicle(db, 'v1'))?.data.mileageKm).toBeNull();
});

test('migration 3 keeps existing vehicles', async () => {
  const old = memoryDb();
  await old.exec(MIGRATIONS[0]);
  await old.exec(MIGRATIONS[1]);
  await old.exec('pragma user_version = 2');
  await old.run(
    `insert into vehicles (id, gallery_id, make, model, body_type, status, created_at, updated_at)
     values ('v1', 'g1', 'Volkswagen', 'Passat', 'kombi', 'draft', '${NOW}', '${NOW}')`,
  );
  await migrate(old);
  const v = await getVehicle(old, 'v1');
  expect(v?.data.fuel).toBeNull();
  expect(v?.data.accidentFree).toBeNull();
  expect(v?.damage).toEqual({});
  expect(v?.damageCheckedAt).toBeNull();
  closeDb(old);
});

test('saveListing creates the listing once, merges patches and queues it', async () => {
  await passat();
  await saveListing(db, 'v1', 'g1', { priceEur: 15000 }, NOW);
  const l = await saveListing(db, 'v1', 'g1', { vatDeductible: true }, NOW);
  expect(l).toMatchObject({ id: 'v1', galleryId: 'g1', status: 'draft', priceEur: 15000, vatDeductible: true, location: null });
  expect(await getListing(db, 'v1')).toEqual(l);
  expect(await db.all("select * from outbox where kind = 'listing'")).toHaveLength(1);
});

test('updateVehicle ignores undefined keys and keeps stored values', async () => {
  await passat();
  await updateVehicle(db, 'v1', { data: { fuel: 'diesel' } as never, details: { notes: 'n' } }, NOW);
  const v = await updateVehicle(
    db, 'v1', { make: undefined, data: { fuel: undefined, mileageKm: 5000 } as never, details: { notes: undefined } }, NOW,
  );
  expect(v).toMatchObject({ make: 'Volkswagen', data: { fuel: 'diesel', mileageKm: 5000 }, details: { notes: 'n' } });
  expect(await getVehicle(db, 'v1')).toEqual(v);
});

test('saveListing ignores undefined keys', async () => {
  await passat();
  await saveListing(db, 'v1', 'g1', { priceEur: 15000, location: 'Berlin' }, NOW);
  const l = await saveListing(db, 'v1', 'g1', { priceEur: undefined, location: null, warrantyMonths: 6 }, NOW);
  expect(l).toMatchObject({ priceEur: 15000, location: null, warrantyMonths: 6 });
});

test('overlapping updateVehicle calls both land, on the same field and on different fields', async () => {
  await passat();
  await Promise.all([
    updateVehicle(db, 'v1', { details: { notes: 'ab' } }, NOW),
    updateVehicle(db, 'v1', { details: { notes: 'abc' } }, NOW),
  ]);
  expect((await getVehicle(db, 'v1'))?.details.notes).toBe('abc');
  await Promise.all([
    updateVehicle(db, 'v1', { data: { mileageKm: 1000 } as never }, NOW),
    updateVehicle(db, 'v1', { details: { notes: 'x' } }, NOW),
  ]);
  expect(await getVehicle(db, 'v1')).toMatchObject({ data: { mileageKm: 1000 }, details: { notes: 'x' } });
});

test('overlapping saveListing calls both land', async () => {
  await passat();
  await Promise.all([
    saveListing(db, 'v1', 'g1', { priceEur: 15000 }, NOW),
    saveListing(db, 'v1', 'g1', { location: 'Berlin' }, NOW),
  ]);
  expect(await getListing(db, 'v1')).toMatchObject({ priceEur: 15000, location: 'Berlin' });
});

test('updateVehicle stamps factsUpdatedAt only when something the listing text uses changes', async () => {
  const created = await passat();
  expect(created.factsUpdatedAt).toBe(NOW);
  const later = '2026-11-10T10:00:00.000Z';
  expect((await updateVehicle(db, 'v1', { data: { vin: 'WVWZZZ1KZAW000001' } as never }, later)).factsUpdatedAt).toBe(NOW);
  expect((await updateVehicle(db, 'v1', { make: 'Volkswagen', details: {} }, later)).factsUpdatedAt).toBe(NOW);
  expect((await updateVehicle(db, 'v1', { data: { mileageKm: 1000 } as never }, later)).factsUpdatedAt).toBe(later);
  expect((await getVehicle(db, 'v1'))?.factsUpdatedAt).toBe(later);
});

test('saveListing stamps factsUpdatedAt when a sale field changes', async () => {
  await passat();
  expect((await saveListing(db, 'v1', 'g1', { priceEur: 15000 }, NOW)).factsUpdatedAt).toBe(NOW);
  const later = '2026-11-10T10:00:00.000Z';
  expect((await saveListing(db, 'v1', 'g1', { priceEur: 15000 }, later)).factsUpdatedAt).toBe(NOW);
  expect((await saveListing(db, 'v1', 'g1', { location: 'Berlin' }, later)).factsUpdatedAt).toBe(later);
  expect((await getListing(db, 'v1'))?.factsUpdatedAt).toBe(later);
});

test('migration 4 starts factsUpdatedAt of existing rows at their updatedAt', async () => {
  const old = memoryDb();
  for (const sql of MIGRATIONS.slice(0, 3)) await old.exec(sql);
  await old.exec('pragma user_version = 3');
  await old.run(
    `insert into vehicles (id, gallery_id, make, model, body_type, status, created_at, updated_at)
     values ('v1', 'g1', 'Volkswagen', 'Passat', 'kombi', 'draft', '${NOW}', '2026-11-10T00:00:00.000Z')`,
  );
  await old.run(`insert into listings (id, gallery_id, created_at, updated_at) values ('v1', 'g1', '${NOW}', '2026-11-11T00:00:00.000Z')`);
  await migrate(old);
  expect((await getVehicle(old, 'v1'))?.factsUpdatedAt).toBe('2026-11-10T00:00:00.000Z');
  expect((await getListing(old, 'v1'))?.factsUpdatedAt).toBe('2026-11-11T00:00:00.000Z');
  closeDb(old);
});
