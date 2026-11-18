// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root). A fake Claude API
// listens on 8091; the local write-listing function reaches it as host.docker.internal:8091.
import { createServer, type Server } from 'node:http';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { createRemote } from '../sync/remote';
import { createListingApi } from './api';
import { isStale } from './stale';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = () => createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);

let refuse = false;
let claude: Server;
beforeAll(
  () =>
    new Promise<void>((resolve) => {
      claude = createServer((req, res) => {
        req.resume();
        req.on('end', () => {
          if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) return void res.writeHead(404).end();
          const common = { id: 'msg_fake', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
          const body = refuse
            ? { ...common, content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } }
            : {
                ...common,
                content: [{ type: 'text', text: JSON.stringify({ titles: ['Golf 1.5 TSI', 'VW Golf, gepflegt', 'Golf mit Sitzheizung'], sections: [{ heading: 'Zusammenfassung', body: 'Ein gepflegter Golf.' }] }) }],
                stop_reason: 'end_turn',
                stop_details: null,
              };
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
        });
      });
      claude.listen(8091, '127.0.0.1', resolve);
    }),
);
afterAll(() => new Promise<void>((resolve) => claude.close(() => resolve())));

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

async function vehicle() {
  const id = crypto.randomUUID();
  const v = await service().from('vehicles').insert({ id, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  if (v.error) throw v.error;
  return id;
}

test('generate stores and returns a German text', async () => {
  refuse = false;
  const vehicleId = await vehicle();
  const result = await createListingApi(await signedIn('staff@bambu.test')).generate({ vehicleId, language: 'de' });
  expect(result).toMatchObject({
    listingId: vehicleId, language: 'de', title: 'Golf 1.5 TSI', edited: false,
    titles: ['Golf 1.5 TSI', 'VW Golf, gepflegt', 'Golf mit Sitzheizung'],
    description: '## Zusammenfassung\nEin gepflegter Golf.',
  });
  const stored = await service().from('listing_texts').select('title, language').eq('listing_id', vehicleId);
  expect(stored.data).toEqual([{ title: 'Golf 1.5 TSI', language: 'de' }]);
});

test('generate maps a refusal to ai_refused', async () => {
  refuse = true;
  const vehicleId = await vehicle();
  expect(await createListingApi(await signedIn('staff@bambu.test')).generate({ vehicleId, language: 'de' })).toEqual({ error: 'ai_refused' });
});

test('a text on a listing the function opened is fresh; bookkeeping keeps it fresh, a fact change does not', async () => {
  refuse = false;
  const vehicleId = await vehicle();
  const client = await signedIn('staff@bambu.test');
  const text = await createListingApi(client).generate({ vehicleId, language: 'de' });
  if ('error' in text) throw new Error(text.error);
  const remote = createRemote(client, async () => new ArrayBuffer(0));
  const stale = async () => {
    const v = (await remote.fetchVehicles(TESTGALERIE)).find((x) => x.id === vehicleId)!;
    const l = (await remote.fetchListings(TESTGALERIE)).find((x) => x.id === vehicleId)!;
    return isStale(text, v.factsUpdatedAt, l.factsUpdatedAt);
  };

  expect(await stale()).toBe(false);
  const bookkeeping = await service().from('vehicles').update({ status: 'ready', tone_enabled: false }).eq('id', vehicleId);
  expect(bookkeeping.error).toBeNull();
  expect(await stale()).toBe(false);
  const fact = await service().from('vehicles').update({ mileage_km: 87000 }).eq('id', vehicleId);
  expect(fact.error).toBeNull();
  expect(await stale()).toBe(true);
});
