import { migrate, type Db } from '../local/db';
import { closeDb, memoryDb } from '../local/testDb';
import { createVehicle, getVehicle } from '../local/vehicles';
import { changeBodyType } from './api';

const NOW = '2026-11-19T10:00:00.000Z';
let db: Db;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
  await createVehicle(db, { id: 'v1', galleryId: 'g1', make: 'Opel', model: 'Crossland', bodyType: 'hatchback', now: NOW });
  await db.run("update vehicles set status = 'shooting'"); // the phone has not pulled since the studio started processing
  await db.run('delete from outbox');
});
afterEach(() => closeDb(db));

// The flush pushes the change and pulls the server's status, as the real sync does.
const deps = (serverStatus: string, sent = true) => ({
  db,
  flush: jest.fn(async () => {
    if (!sent) return false;
    await db.run('delete from outbox');
    await db.run('update vehicles set status = ?', [serverStatus]);
    return true;
  }),
  confirm: jest.fn(async () => true),
  startProcessing: jest.fn(async () => ({ queued: ['p1'] })),
});

test('a set the server already processed is re-rendered although the phone still says shooting', async () => {
  const d = deps('ready');
  expect(await changeBodyType(d, 'v1', 'suv', NOW)).toBe('rerendered');
  expect(d.confirm).toHaveBeenCalledTimes(1);
  expect(d.startProcessing).toHaveBeenCalledWith({ vehicleId: 'v1', rerender: true });
  expect((await getVehicle(db, 'v1'))?.bodyType).toBe('suv');
});

test('an unprocessed vehicle is only saved, without asking', async () => {
  const d = deps('shooting');
  expect(await changeBodyType(d, 'v1', 'suv', NOW)).toBe('saved');
  expect(d.confirm).not.toHaveBeenCalled();
  expect(d.startProcessing).not.toHaveBeenCalled();
});

test('declining the re-render keeps the change and renders nothing', async () => {
  const d = { ...deps('ready'), confirm: jest.fn(async () => false) };
  expect(await changeBodyType(d, 'v1', 'suv', NOW)).toBe('saved');
  expect(d.startProcessing).not.toHaveBeenCalled();
  expect((await getVehicle(db, 'v1'))?.bodyType).toBe('suv');
});

test('offline a processed set is saved and reported offline', async () => {
  await db.run("update vehicles set status = 'ready'");
  const d = deps('ready', false);
  expect(await changeBodyType(d, 'v1', 'suv', NOW)).toBe('offline');
  expect(d.startProcessing).not.toHaveBeenCalled();
});
