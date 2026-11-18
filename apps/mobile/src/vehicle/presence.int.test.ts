// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { othersEditing } from './presence';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await sleep(100);
};

function join(client: SupabaseClient<Database>, topic: string, device: string, name: string) {
  const channel = client.channel(topic, { config: { private: true, presence: { key: device } } });
  const status = new Promise<string>((resolve) => {
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') channel.track({ device, name }).then(() => resolve(s));
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') resolve(s);
    });
  });
  return { channel, status };
}

const vehicleId = 'd0000000-0000-0000-0000-0000000000a6';
const topic = `vehicle:${vehicleId}`;

let owner: SupabaseClient<Database>, staff: SupabaseClient<Database>, other: SupabaseClient<Database>;
beforeAll(async () => {
  owner = await signedIn('owner@bambu.test');
  staff = await signedIn('staff@bambu.test');
  other = await signedIn('other@bambu.test');
  const service = createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);
  const { error } = await service.from('vehicles').upsert({
    id: vehicleId, gallery_id: 'e0000000-0000-0000-0000-000000000001', make: 'Test', model: 'Presence', body_type: 'sedan',
  } as never);
  if (error) throw error;
});

afterAll(async () => {
  const service = createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);
  await service.from('vehicles').delete().eq('id', vehicleId);
  for (const c of [owner, staff, other]) await c.removeAllChannels();
});

test('two members of the gallery see each other on the vehicle channel', async () => {
  const a = join(owner, topic, 'device-a', 'owner');
  const b = join(staff, topic, 'device-b', 'staff');
  expect(await a.status).toBe('SUBSCRIBED');
  expect(await b.status).toBe('SUBSCRIBED');
  const seen = (c: typeof a.channel, me: string) =>
    othersEditing(c.presenceState<{ device: string; name: string }>() as never, me);
  await until(() => seen(a.channel, 'device-a').length > 0 && seen(b.channel, 'device-b').length > 0);
  expect(seen(a.channel, 'device-a')).toEqual(['staff']);
  expect(seen(b.channel, 'device-b')).toEqual(['owner']);
  await a.channel.untrack();
  await b.channel.untrack();
});

test('a member of another gallery cannot join it', async () => {
  const c = join(other, topic, 'device-c', 'other');
  expect(await c.status).not.toBe('SUBSCRIBED');
}, 20000);
