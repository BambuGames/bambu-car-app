// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root).
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { inviteMember, listMembers, removeMember } from './members';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

test('the app lists, invites and removes members through the function and reads its error codes', async () => {
  const owner = await signedIn('owner@bambu.test');
  const email = `app-${Date.now()}@bambu.test`;
  const invited = await inviteMember(owner, TESTGALERIE, email);
  expect(invited).toMatchObject({ invited: true });
  const list = await listMembers(owner, TESTGALERIE);
  expect('members' in list && list.members.some((m) => m.email === email && !m.confirmed)).toBe(true);
  expect(await inviteMember(owner, TESTGALERIE, email)).toEqual({ error: 'already_member' });
  expect(await listMembers(await signedIn('staff@bambu.test'), TESTGALERIE)).toEqual({ error: 'not_owner' });
  expect(await removeMember(owner, TESTGALERIE, (invited as { userId: string }).userId)).toEqual({ removed: true });

  const service = createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);
  await service.auth.admin.deleteUser((invited as { userId: string }).userId);
});
