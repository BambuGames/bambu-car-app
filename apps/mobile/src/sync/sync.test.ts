import { emptyVehicleData } from '../domain/vehicleData';
import { replaceCatalog, searchMakes } from '../local/catalog';
import { migrate, type Db, type SqlValue } from '../local/db';
import { getListing, getListingTexts, saveListing } from '../local/listings';
import { hasPending } from '../local/outbox';
import { listPhotos, savePhoto } from '../local/photos';
import { closeDb, memoryDb } from '../local/testDb';
import { createSyncScheduler } from './scheduler';
import { createVehicle, getVehicle, listVehicles, updateVehicle } from '../local/vehicles';
import { FakeRemote } from './fakeRemote';
import { flush, syncAndCount, syncOnce } from './sync';

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
    id: 'v9', galleryId: 'g1', make: 'BMW', model: '320d', bodyType: 'sedan', status: 'draft', data: emptyVehicleData(), damage: {}, damageCheckedAt: null, details: {}, createdAt: NOW, updatedAt: NOW, factsUpdatedAt: NOW,
  });
  await sync();
  expect((await listVehicles(db, 'g1')).map((v) => v.id)).toContain('v9');
});

test('pull does not overwrite a vehicle with pending local changes', async () => {
  await vehicle('v1', 'Passat');
  fake.vehicles.set('v1', {
    id: 'v1', galleryId: 'g1', make: 'Volkswagen', model: 'Golf', bodyType: 'kombi', status: 'draft', data: emptyVehicleData(), damage: {}, damageCheckedAt: null, details: {}, createdAt: NOW, updatedAt: NOW, factsUpdatedAt: NOW,
  });
  fake.failOnce('upsertVehicle');
  await sync();
  expect((await getVehicle(db, 'v1'))?.model).toBe('Passat');
});

test('a local edit that lands while the pull runs is neither overwritten nor overwrites the pulled row', async () => {
  await vehicle('v1');
  await sync(); // on the server, nothing pending
  fake.vehicles.set('v1', { ...fake.vehicles.get('v1')!, model: 'Golf' }); // changed on another device
  // The edit starts right after the pull checked the outbox for v1.
  let edit: Promise<unknown> | undefined;
  const raced: Db = {
    ...db,
    get: async <T,>(sql: string, params?: SqlValue[]) => {
      const row = await db.get<T>(sql, params);
      if (!edit && sql.startsWith('select 1 from outbox') && params?.[0] === 'vehicle') {
        edit = updateVehicle(db, 'v1', { data: { mileageKm: 1000 } as never }, NOW);
      }
      return row;
    },
  };
  await syncOnce(raced, fake, 'g1', () => T0);
  await edit;
  expect(await getVehicle(db, 'v1')).toMatchObject({ model: 'Golf', data: { mileageKm: 1000 } });
  expect(await hasPending(db, 'vehicle', 'v1')).toBe(true);
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

test('pushes the new vehicle columns', async () => {
  await vehicle('v1');
  await updateVehicle(db, 'v1', { data: { fuel: 'diesel' } as never, damage: { hood: 'painted' } }, NOW);
  await sync();
  expect(fake.vehicles.get('v1')?.data.fuel).toBe('diesel');
  expect(fake.vehicles.get('v1')?.damage).toEqual({ hood: 'painted' });
});

test('two devices saving the same listing offline end in one row', async () => {
  const db2 = memoryDb();
  await migrate(db2);
  await vehicle('v1');
  await createVehicle(db2, { id: 'v1', galleryId: 'g1', make: 'Volkswagen', model: 'Passat', bodyType: 'kombi', now: NOW });
  await saveListing(db, 'v1', 'g1', { priceEur: 10000 }, NOW);
  await saveListing(db2, 'v1', 'g1', { priceEur: 12000 }, NOW);
  await sync();
  await syncOnce(db2, fake, 'g1', () => T0);
  expect(fake.listings.size).toBe(1);
  expect(fake.listings.get('v1')?.priceEur).toBe(12000);
  await sync();
  expect((await getListing(db, 'v1'))?.priceEur).toBe(12000);
  closeDb(db2);
});

test('a pending listing is not overwritten by the pull', async () => {
  await vehicle('v1');
  await saveListing(db, 'v1', 'g1', { priceEur: 10000 }, NOW);
  fake.listings.set('v1', { id: 'v1', galleryId: 'g1', status: 'draft', priceEur: 99, vatDeductible: null, warrantyMonths: null, location: null, createdAt: NOW, updatedAt: NOW, factsUpdatedAt: NOW });
  fake.failOnce('upsertListing');
  await sync();
  expect((await getListing(db, 'v1'))?.priceEur).toBe(10000);
});

test('pulls listings and their texts into the cache', async () => {
  fake.listings.set('v1', { id: 'v1', galleryId: 'g1', status: 'draft', priceEur: 5, vatDeductible: null, warrantyMonths: null, location: null, createdAt: NOW, updatedAt: NOW, factsUpdatedAt: NOW });
  fake.listingTexts.set('v1/de', { listingId: 'v1', galleryId: 'g1', language: 'de', titles: ['a'], title: 'a', description: 'd', model: 'm', generatedAt: NOW, edited: false, updatedAt: NOW });
  await vehicle('v1');
  await sync();
  expect((await getListing(db, 'v1'))?.priceEur).toBe(5);
  expect((await getListingTexts(db, 'v1'))[0]).toMatchObject({ language: 'de', titles: ['a'], edited: false });
});

test('flush resolves true once the entities left the outbox, false while they stay', async () => {
  await vehicle('v1');
  const sched = createSyncScheduler(async () => void (await sync()));
  expect(await flush(db, sched, [{ kind: 'vehicle', id: 'v1' }])).toBe(true);
  await vehicle('v2');
  fake.failOnce('upsertVehicle');
  expect(await flush(db, sched, [{ kind: 'vehicle', id: 'v2' }])).toBe(false);
});
