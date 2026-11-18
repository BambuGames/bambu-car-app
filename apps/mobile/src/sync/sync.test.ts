import { replaceCatalog, searchMakes } from '../local/catalog';
import { migrate, type Db } from '../local/db';
import { hasPending } from '../local/outbox';
import { listPhotos, savePhoto } from '../local/photos';
import { closeDb, memoryDb } from '../local/testDb';
import { createVehicle, getVehicle, listVehicles } from '../local/vehicles';
import { FakeRemote } from './fakeRemote';
import { syncAndCount, syncOnce } from './sync';

const NOW = '2026-11-09T10:00:00.000Z';
const T0 = Date.parse(NOW);
let db: Db;
let fake: FakeRemote;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
  fake = new FakeRemote();
});
afterEach(() => closeDb(db));

const vehicle = (id: string, model = 'Passat') =>
  createVehicle(db, { id, galleryId: 'g1', make: 'Volkswagen', model, bodyType: 'kombi', now: NOW });
const front = (vehicleId = 'v1', qc: Record<string, unknown> = {}) =>
  savePhoto(db, { id: 'p1', vehicleId, galleryId: 'g1', slot: 'front', localUri: 'file:///front.jpg', capturedAt: NOW, capture: {}, qc });
const sync = (at = T0) => syncOnce(db, fake, 'g1', () => at);

test('pushes qc with the photo row', async () => {
  const qc = { issues: ['blurry'], accepted: true, laplacianVar: 12, meanLuma: 90, clippedShare: 0 };
  await vehicle('v1');
  await front('v1', qc);
  await sync();
  expect(fake.photos.get('v1/front')?.qc).toEqual(qc);
});

test('pushes a new vehicle before its photo', async () => {
  await vehicle('v1');
  await front();
  await sync();
  expect(fake.calls.map((c) => c.name).slice(0, 3)).toEqual(['upsertVehicle', 'uploadPhoto', 'upsertPhoto']);
});

test('uploads the photo file then upserts its row and marks it uploaded', async () => {
  await vehicle('v1');
  await front();
  await sync();
  expect((await listPhotos(db, 'v1'))[0]).toMatchObject({ uploadState: 'uploaded', originalPath: 'g1/v1/front.jpg' });
});

test('retries a photo whose row upsert failed after the file uploaded', async () => {
  await vehicle('v1');
  await front();
  fake.failOnce('upsertPhoto');

  expect(await sync(T0)).toMatchObject({ failed: 1, pending: 1 });
  expect((await listPhotos(db, 'v1'))[0].uploadState).toBe('failed');
  expect((await sync(T0 + 4999)).pushed).toBe(0);
  await sync(T0 + 5000);

  expect((await listPhotos(db, 'v1'))[0].uploadState).toBe('uploaded');
  expect([...fake.photos.keys()]).toEqual(['v1/front']);
  expect([...fake.files.keys()]).toEqual(['g1/v1/front.jpg']);
});

test('a photo re-shot during its upload is uploaded again with the new file', async () => {
  await vehicle('v1');
  await front();
  fake.beforeUpload = async () => {
    fake.beforeUpload = undefined;
    await savePhoto(db, { id: 'p2', vehicleId: 'v1', galleryId: 'g1', slot: 'front', localUri: 'file:///front-2.jpg', capturedAt: NOW, capture: {}, qc: {} });
  };
  await sync();
  expect(fake.files.get('g1/v1/front.jpg')).toBe('file:///front-2.jpg');
  expect((await listPhotos(db, 'v1'))[0].uploadState).toBe('uploaded');
});

test('keeps failed items for later and continues with others', async () => {
  await vehicle('v1');
  await vehicle('v2');
  fake.failOnce('upsertVehicle');

  expect(await sync()).toMatchObject({ pushed: 1, failed: 1 });
  expect([...fake.vehicles.keys()]).toEqual(['v2']);
  expect(await hasPending(db, 'vehicle', 'v1')).toBe(true);
});

test('pull adds vehicles created on another device', async () => {
  fake.vehicles.set('v9', {
    id: 'v9', galleryId: 'g1', make: 'BMW', model: '320d', bodyType: 'sedan', status: 'draft', details: {}, createdAt: NOW, updatedAt: NOW,
  });
  await sync();
  expect((await listVehicles(db, 'g1')).map((v) => v.id)).toContain('v9');
});

test('pull does not overwrite a vehicle with pending local changes', async () => {
  await vehicle('v1', 'Passat');
  fake.vehicles.set('v1', {
    id: 'v1', galleryId: 'g1', make: 'Volkswagen', model: 'Golf', bodyType: 'kombi', status: 'draft', details: {}, createdAt: NOW, updatedAt: NOW,
  });
  fake.failOnce('upsertVehicle');
  await sync();
  expect((await getVehicle(db, 'v1'))?.model).toBe('Passat');
});

test('syncAndCount reports what waits when the server cannot be reached', async () => {
  await vehicle('v1');
  fake.failOnce('upsertVehicle');
  fake.failOnce('fetchVehicles');
  expect(await syncAndCount(db, fake, 'g1', () => T0, true)).toEqual({ pending: 0, failed: 1 });
});

test('syncAndCount tries nothing offline and reports what waits', async () => {
  await vehicle('v1');
  expect(await syncAndCount(db, fake, 'g1', () => T0, false)).toEqual({ pending: 1, failed: 0 });
  expect(fake.calls).toEqual([]);
});

test('the first sync of a run fetches the catalog again even when the device has one', async () => {
  await replaceCatalog(db, [{ id: 9, name: 'Opel' }], []);
  await syncOnce(db, fake, 'g1', () => T0);
  expect(await searchMakes(db, 'Volks')).toEqual([]); // a normal run leaves a filled catalog alone
  await syncOnce(db, fake, 'g1', () => T0, true);
  expect((await searchMakes(db, 'Volks')).map((m) => m.name)).toEqual(['Volkswagen']);
});
