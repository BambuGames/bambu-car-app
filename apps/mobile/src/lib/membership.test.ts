import { migrate, type Db } from '../local/db';
import { closeDb, memoryDb } from '../local/testDb';
import { cachedMembership, refreshMembership, type Membership } from './membership';

const gallery: Membership = { galleryId: 'g1', galleryName: 'Testgalerie', role: 'staff' };
const unreachable = async (): Promise<Membership | null> => {
  throw new TypeError('Network request failed');
};
let db: Db;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
});
afterEach(() => closeDb(db));

test('a device that never asked the server does not know the membership', async () => {
  expect(await cachedMembership(db)).toBeUndefined();
});

test('a failed read with nothing cached leaves the membership unknown, not "no gallery"', async () => {
  expect(await refreshMembership(db, unreachable)).toBeUndefined();
});

test('a failed read keeps the membership the server gave before', async () => {
  await refreshMembership(db, async () => gallery);
  expect(await refreshMembership(db, unreachable)).toEqual(gallery);
});

test('"no gallery" from the server is remembered as no gallery', async () => {
  expect(await refreshMembership(db, async () => null)).toBeNull();
  expect(await cachedMembership(db)).toBeNull();
});
