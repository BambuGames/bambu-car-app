// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root).
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { fetchCredits } from './credits';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

test('staff read no ledger rows; the owner reads them', async () => {
  const note = `int ${crypto.randomUUID()}`;
  const service = createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);
  const granted = await service.rpc('admin_grant_credits', { p_gallery_id: TESTGALERIE, p_amount: 3, p_note: note });
  if (granted.error) throw granted.error;

  const owner = await fetchCredits(await signedIn('owner@bambu.test'), TESTGALERIE);
  expect(owner.balance).toBe(granted.data);
  expect(owner.entries[0]).toMatchObject({ amount: 3, reason: 'grant', note, vehicle: null });

  const staff = await fetchCredits(await signedIn('staff@bambu.test'), TESTGALERIE);
  expect(staff.entries).toEqual([]);
});
