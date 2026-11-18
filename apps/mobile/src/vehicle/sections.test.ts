import type { Vehicle } from '../domain/vehicle';
import { emptyVehicleData, type VehicleData } from '../domain/vehicleData';
import { migrate, type Db } from '../local/db';
import { closeDb, memoryDb } from '../local/testDb';
import { createVehicle, getVehicle } from '../local/vehicles';
import { changeBodyType } from './api';
import { sectionProgress } from './sections';

const NOW = '2026-11-18T10:00:00.000Z';
let db: Db;
let ready: Vehicle;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
  await createVehicle(db, { id: 'v1', galleryId: 'g1', make: 'Opel', model: 'Crossland', bodyType: 'hatchback', now: NOW });
  await db.run("update vehicles set status = 'ready' where id = 'v1'");
  ready = (await getVehicle(db, 'v1'))!;
});
afterEach(() => closeDb(db));

const vehicle = (overrides: { data?: Partial<VehicleData>; details?: Vehicle['details'] } = {}): Vehicle => ({
  ...ready,
  status: 'draft',
  data: { ...emptyVehicleData(), ...overrides.data },
  details: overrides.details ?? {},
});

test('sectionProgress counts a section once any of its fields is set', () => {
  expect(sectionProgress(vehicle({ data: { mileageKm: 1000 } }), null)).toEqual({ done: 2, total: 7 }); // basics + history
  expect(sectionProgress(vehicle({ data: { accidentFree: false }, details: { equipment: ['abs'] } }), null)).toEqual({ done: 3, total: 7 });
  expect(sectionProgress(vehicle(), { priceEur: 9000 } as never)).toEqual({ done: 2, total: 7 });
});

test('changeBodyType re-renders a processed set without a credit and stays local offline', async () => {
  const startProcessing = jest.fn().mockResolvedValue({ queued: [] });
  const confirm = async () => true;
  expect(await changeBodyType({ db, flush: async () => true, confirm, startProcessing }, ready.id, 'suv', NOW)).toBe('rerendered');
  expect(startProcessing).toHaveBeenCalledWith({ vehicleId: ready.id, rerender: true });
  expect(await changeBodyType({ db, flush: async () => false, confirm, startProcessing }, ready.id, 'kombi', NOW)).toBe('offline');
  expect((await getVehicle(db, ready.id))!.bodyType).toBe('kombi');
  await db.run("update vehicles set status = 'draft' where id = 'v1'");
  expect(await changeBodyType({ db, flush: async () => true, confirm, startProcessing }, ready.id, 'sedan', NOW)).toBe('saved');
});

test('changeBodyType returns the error when the re-render could not be queued', async () => {
  const startProcessing = jest.fn().mockResolvedValue({ error: 'internal' });
  const confirm = async () => true;
  expect(await changeBodyType({ db, flush: async () => true, confirm, startProcessing }, ready.id, 'suv', NOW)).toBe('internal');
  startProcessing.mockResolvedValue({ error: 'offline' });
  expect(await changeBodyType({ db, flush: async () => true, confirm, startProcessing }, ready.id, 'kombi', NOW)).toBe('offline');
  expect((await getVehicle(db, ready.id))!.bodyType).toBe('kombi');
});
