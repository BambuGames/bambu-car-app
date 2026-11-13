// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root).
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { createStudioApi } from './api';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
const ANDERE = 'e0000000-0000-0000-0000-000000000002';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

const admin = () => createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);

async function vehicleWithPhoto(gallery: string) {
  const vehicleId = crypto.randomUUID();
  const photoId = crypto.randomUUID();
  const service = admin();
  const v = await service.from('vehicles').insert({ id: vehicleId, gallery_id: gallery, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  if (v.error) throw v.error;
  const p = await service.from('photos').insert({
    id: photoId, vehicle_id: vehicleId, gallery_id: gallery, slot: 'front',
    original_path: `${gallery}/${vehicleId}/front.jpg`, captured_at: new Date().toISOString(),
  });
  if (p.error) throw p.error;
  return { vehicleId, photoId };
}

test('touch-up edits and plate decisions are saved on the photo', async () => {
  const api = createStudioApi(await signedIn('owner@bambu.test'));
  const { vehicleId, photoId } = await vehicleWithPhoto(TESTGALERIE);
  await api.saveMaskEdits(photoId, [{ type: 'remove', point: [0.2, 0.3] }]);
  await api.savePlate(photoId, [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.2 }, { x: 0.3, y: 0.25 }, { x: 0.1, y: 0.25 }], 'confirmed');
  const { photos } = await api.fetchStudio(vehicleId);
  expect(photos[0].mask_edits).toEqual([{ type: 'remove', point: [0.2, 0.3] }]);
  expect(photos[0].plate_status).toBe('confirmed');
  expect(photos[0].plate_corners).toEqual([[0.1, 0.2], [0.3, 0.2], [0.3, 0.25], [0.1, 0.25]]);
});

test('the studio offers the three platform studios and saves the choice', async () => {
  const api = createStudioApi(await signedIn('staff@bambu.test'));
  const { vehicleId } = await vehicleWithPhoto(TESTGALERIE);
  const before = await api.fetchStudio(vehicleId);
  expect(before.backgrounds.filter((b) => b.gallery_id === null).map((b) => b.name)).toEqual(['Studio Weiß', 'Studio Hellgrau', 'Studio Dunkel']);
  await api.setStudioOptions(vehicleId, { backgroundId: before.backgrounds[2].id, toneEnabled: false });
  const after = await api.fetchStudio(vehicleId);
  expect(after.vehicle).toMatchObject({ background_id: before.backgrounds[2].id, tone_enabled: false });
  // The gallery's default is whatever the owner chose last (the emulator changes it too).
  const gallery = await admin().from('galleries').select('default_background_id').eq('id', TESTGALERIE).single();
  expect(before.vehicle).toMatchObject({ credit_charged_at: null, gallery: { default_background_id: gallery.data!.default_background_id } });
});

test("another gallery's vehicle cannot be processed", async () => {
  const api = createStudioApi(await signedIn('owner@bambu.test'));
  const { vehicleId } = await vehicleWithPhoto(ANDERE);
  expect(await api.startProcessing({ vehicleId })).toEqual({ error: 'not_member' });
});

test('a gallery without credit is told so', async () => {
  const api = createStudioApi(await signedIn('other@bambu.test'));
  const { vehicleId } = await vehicleWithPhoto(ANDERE);
  expect(await api.startProcessing({ vehicleId })).toEqual({ error: 'no_credit' });
});

test('a re-render that cannot be queued is reported, not ignored', async () => {
  const api = createStudioApi(await signedIn('owner@bambu.test'));
  const { vehicleId, photoId } = await vehicleWithPhoto(ANDERE);
  await expect(api.renderPhoto(vehicleId, photoId)).rejects.toThrow('not_member');
});
