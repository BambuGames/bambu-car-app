// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root). A fake image worker
// listens on 8090 (stop the real worker first), as in supabase/tests/integration/export-vehicle.test.ts.
import { createServer, type Server } from 'node:http';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { createExportLink } from './api';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
const ANDERE = 'e0000000-0000-0000-0000-000000000002';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = () => createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);

let worker: Server;
beforeAll(
  () =>
    new Promise<void>((resolve) => {
      worker = createServer((req, res) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', async () => {
          const body = JSON.parse(data);
          const path = `${TESTGALERIE}/${body.vehicle_id}/exports/${body.version}.zip`;
          await service().storage.from('processed').upload(path, Buffer.from('PK\x05\x06' + '\0'.repeat(18)), { contentType: 'application/zip', upsert: true });
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ path, count: body.photo_ids.length, bytes: 22 }));
        });
      });
      worker.listen(8090, '127.0.0.1', resolve);
    }),
);
afterAll(() => new Promise<void>((resolve) => worker.close(() => resolve())));

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

async function vehicleWithPhoto(gallery: string) {
  const vehicleId = crypto.randomUUID();
  const photoId = crypto.randomUUID();
  const v = await service().from('vehicles').insert({ id: vehicleId, gallery_id: gallery, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  if (v.error) throw v.error;
  const p = await service().from('photos').insert({
    id: photoId, vehicle_id: vehicleId, gallery_id: gallery, slot: 'front',
    original_path: `${gallery}/${vehicleId}/front.jpg`, captured_at: new Date().toISOString(),
  });
  if (p.error) throw p.error;
  return { vehicleId, photoId };
}

test('the app gets a ZIP link from export-vehicle', async () => {
  const { vehicleId, photoId } = await vehicleWithPhoto(TESTGALERIE);
  const result = await createExportLink(await signedIn('staff@bambu.test'), { vehicleId, version: 'originals', photoIds: [photoId] });
  expect(result).toMatchObject({ count: 1, url: expect.stringContaining('download=VW-Golf.zip') });
});

test("another gallery's vehicle reads as not_member", async () => {
  const { vehicleId, photoId } = await vehicleWithPhoto(ANDERE);
  expect(await createExportLink(await signedIn('owner@bambu.test'), { vehicleId, version: 'plain', photoIds: [photoId] })).toEqual({ error: 'not_member' });
});
