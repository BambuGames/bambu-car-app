// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root).
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { emptyVehicleData } from '../domain/vehicleData';
import type { Database } from '../lib/database.types';
import { createRemote } from './remote';
import { photoPath } from './sync';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
// JPEG start and end markers; Storage keeps bytes as they are and does not decode images.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

async function readLocal(uri: string): Promise<ArrayBuffer> {
  const bytes = await readFile(fileURLToPath(uri));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test('real remote stores a vehicle and photo the gallery can read back and other galleries cannot', async () => {
  const staff = await signedIn('staff@bambu.test');
  const remote = createRemote(staff, readLocal);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await remote.upsertVehicle({
    id, galleryId: TESTGALERIE, make: 'Volkswagen', model: 'Passat', bodyType: 'kombi',
    status: 'shooting', data: emptyVehicleData(), damage: {}, damageCheckedAt: null, details: {}, createdAt: now, updatedAt: now, factsUpdatedAt: now,
  });
  const file = join(tmpdir(), `photo-${id}.jpg`);
  await writeFile(file, JPEG);
  const path = photoPath(TESTGALERIE, id, 'front');
  await remote.uploadPhoto(path, pathToFileURL(file).href);
  await remote.upsertPhoto({
    id: crypto.randomUUID(), vehicleId: id, galleryId: TESTGALERIE, slot: 'front',
    originalPath: path, capturedAt: now, capture: { cameraMode: 'normal' }, qc: { issues: ['dark'], accepted: true },
  });

  expect((await remote.fetchVehicles(TESTGALERIE)).map((v) => v.id)).toContain(id);
  expect((await remote.fetchPhotos(TESTGALERIE)).find((p) => p.vehicleId === id)).toMatchObject({ slot: 'front', originalPath: path });
  const { data: row } = await staff.from('photos').select('qc').eq('vehicle_id', id).single();
  expect(row?.qc).toEqual({ issues: ['dark'], accepted: true });
  const download = await staff.storage.from('originals').download(path);
  expect(Buffer.from(await download.data!.arrayBuffer())).toEqual(JPEG);

  const other = createRemote(await signedIn('other@bambu.test'), readLocal);
  expect(await other.fetchVehicles(TESTGALERIE)).toEqual([]);
});

test('upsertListing then fetchListings returns the row for gallery members only', async () => {
  const staff = await signedIn('staff@bambu.test');
  const remote = createRemote(staff, readLocal);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await remote.upsertVehicle({
    id, galleryId: TESTGALERIE, make: 'Volkswagen', model: 'Passat', bodyType: 'kombi',
    status: 'draft', data: { ...emptyVehicleData(), fuel: 'diesel', mileageKm: 1000 }, damage: { hood: 'painted' }, damageCheckedAt: now,
    details: {}, createdAt: now, updatedAt: now, factsUpdatedAt: now,
  });
  await remote.upsertListing({
    id, galleryId: TESTGALERIE, status: 'draft', priceEur: 15000, vatDeductible: true, warrantyMonths: 12, location: 'Berlin',
    createdAt: now, updatedAt: now, factsUpdatedAt: now,
  });

  const listing = (await remote.fetchListings(TESTGALERIE)).find((l) => l.id === id);
  expect(listing).toMatchObject({ priceEur: 15000, vatDeductible: true, location: 'Berlin' });
  expect(Date.parse(listing!.factsUpdatedAt)).toBeGreaterThan(0); // the server's stamp, never sent by the app
  expect((await remote.fetchVehicles(TESTGALERIE)).find((v) => v.id === id)).toMatchObject({
    data: { fuel: 'diesel', mileageKm: 1000, vin: null }, damage: { hood: 'painted' },
  });
  await remote.fetchListingTexts(TESTGALERIE);

  const other = createRemote(await signedIn('other@bambu.test'), readLocal);
  expect(await other.fetchListings(TESTGALERIE)).toEqual([]);
});
