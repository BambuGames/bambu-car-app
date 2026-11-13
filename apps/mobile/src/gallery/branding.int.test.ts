// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root).
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { fetchGallerySettings, saveWatermark, setDefaultBackground, uploadBranding } from './branding';
import { WATERMARK_DEFAULTS } from './watermarkLayout';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
// The owner test writes to the other gallery: Testgalerie's logo and banner are what the emulator renders with.
const ANDERE = 'e0000000-0000-0000-0000-000000000002';
const STUDIO_DUNKEL = 'b0000000-0000-0000-0000-000000000003';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
// A 1×1 transparent PNG.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

const service = () => createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);
const branding = async (gallery: string) =>
  (await service().from('galleries').select('watermark, default_background_id, logo_path, banner_path').eq('id', gallery).single()).data;

let saved: Awaited<ReturnType<typeof branding>>;
beforeAll(async () => {
  saved = await branding(ANDERE);
});
afterAll(async () => {
  await service().from('galleries').update(saved!).eq('id', ANDERE);
  await service().storage.from('branding').remove([`${ANDERE}/logo.png`]);
});

test('staff cannot change gallery settings', async () => {
  const staff = await signedIn('staff@bambu.test');
  const before = await branding(TESTGALERIE);
  await expect(saveWatermark(staff, TESTGALERIE, { ...WATERMARK_DEFAULTS, position: 'center' })).rejects.toThrow('not_owner');
  await expect(setDefaultBackground(staff, TESTGALERIE, STUDIO_DUNKEL)).rejects.toThrow('not_owner');
  await expect(uploadBranding(staff, TESTGALERIE, 'logo', PNG)).rejects.toThrow();
  expect(await branding(TESTGALERIE)).toEqual(before);
});

test('the owner saves the watermark, the default background and a logo', async () => {
  const owner = await signedIn('other@bambu.test');
  const watermark = { position: 'top_left' as const, width: 0.26, opacity: 0.5, band: { edge: 'bottom' as const, color: '#0B57D0' } };
  await saveWatermark(owner, ANDERE, watermark);
  await setDefaultBackground(owner, ANDERE, STUDIO_DUNKEL);
  expect(await uploadBranding(owner, ANDERE, 'logo', PNG)).toBe(`${ANDERE}/logo.png`);
  const { gallery } = await fetchGallerySettings(owner, ANDERE);
  expect(gallery).toMatchObject({ watermark, default_background_id: STUDIO_DUNKEL, logo_path: `${ANDERE}/logo.png` });
});
