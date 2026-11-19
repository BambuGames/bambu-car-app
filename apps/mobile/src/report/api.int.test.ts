// Runs against the local Supabase stack (`npm run test:int:mobile` from the repo root). A fake OpenAI API
// listens on 8091; the local read-report function reaches it as host.docker.internal:8091.
import { createServer, type Server } from 'node:http';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { createReportApi } from './api';

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = () => createClient<Database>(process.env.API_URL!, process.env.SERVICE_ROLE_KEY!, noSession);
const PDF = new TextEncoder().encode('%PDF-1.4\n% Gutachten\n%%EOF\n');

let openai: Server;
beforeAll(
  () =>
    new Promise<void>((resolve) => {
      openai = createServer((req, res) => {
        req.resume();
        req.on('end', () => {
          if (req.method !== 'POST' || req.url?.split('?')[0] !== '/v1/responses') return void res.writeHead(404).end();
          const output = {
            mileageKm: { value: 87000, quote: 'km-Stand 87.000' },
            damage: [{ part: 'hood', state: 'painted', quote: 'Motorhaube lackiert' }],
            equipment: [],
          };
          const body = {
            id: 'resp_fake', object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'completed', incomplete_details: null, error: null,
            model: 'gpt-6.2-sol',
            output: [{ id: 'msg_fake', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }],
            instructions: null, metadata: {}, parallel_tool_calls: true, temperature: 1, tool_choice: 'auto', tools: [], top_p: 1,
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
          };
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
        });
      });
      openai.listen(8091, '127.0.0.1', resolve);
    }),
);
afterAll(() => new Promise<void>((resolve) => openai.close(() => resolve())));

async function signedIn(email: string) {
  const client = createClient<Database>(process.env.API_URL!, process.env.ANON_KEY!, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: 'dev-password-1' });
  if (error) throw error;
  return client;
}

test('upload, read and close leave no file behind and empty the suggestions', async () => {
  const vehicleId = crypto.randomUUID();
  const made = await service().from('vehicles').insert({ id: vehicleId, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  if (made.error) throw made.error;
  const client = await signedIn('staff@bambu.test');
  const api = createReportApi(client);
  const readId = crypto.randomUUID();

  const paths = await api.upload(TESTGALERIE, vehicleId, readId, [{ bytes: PDF, mime: 'application/pdf', name: '1.pdf' }]);
  expect(paths).toEqual([`${TESTGALERIE}/${vehicleId}/${readId}/1.pdf`]);

  const result = await api.read(vehicleId, readId, paths);
  expect(result).toEqual({
    suggestions: [
      { kind: 'field', field: 'mileageKm', value: 87000, quote: 'km-Stand 87.000' },
      { kind: 'damage', part: 'hood', state: 'painted', quote: 'Motorhaube lackiert' },
    ],
  });

  // A screen closed halfway finds the read again.
  expect(await api.openRead(vehicleId)).toMatchObject({ id: readId, files: paths });

  await api.close(readId, paths);
  expect(await api.openRead(vehicleId)).toBeNull();
  const row = await service().from('report_reads').select('suggestions, closed_at').eq('id', readId).single();
  expect(row.data!.suggestions).toBeNull();
  expect(row.data!.closed_at).not.toBeNull();
  const left = await service().storage.from('reports').list(`${TESTGALERIE}/${vehicleId}/${readId}`);
  expect(left.data).toEqual([]);
});

test('a second read with the same read id is a bad request', async () => {
  const vehicleId = crypto.randomUUID();
  await service().from('vehicles').insert({ id: vehicleId, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  const api = createReportApi(await signedIn('staff@bambu.test'));
  const readId = crypto.randomUUID();
  const paths = await api.upload(TESTGALERIE, vehicleId, readId, [{ bytes: PDF, mime: 'application/pdf', name: '1.pdf' }]);
  expect('suggestions' in (await api.read(vehicleId, readId, paths))).toBe(true);
  expect(await api.read(vehicleId, readId, paths)).toEqual({ error: 'bad_request' });
  await api.close(readId, paths);
});

test('close fails when another gallery tries it (nothing is deleted or emptied)', async () => {
  const vehicleId = crypto.randomUUID();
  await service().from('vehicles').insert({ id: vehicleId, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  const staff = createReportApi(await signedIn('staff@bambu.test'));
  const readId = crypto.randomUUID();
  const paths = await staff.upload(TESTGALERIE, vehicleId, readId, [{ bytes: PDF, mime: 'application/pdf', name: '1.pdf' }]);
  expect('suggestions' in (await staff.read(vehicleId, readId, paths))).toBe(true);

  await expect(createReportApi(await signedIn('other@bambu.test')).close(readId, paths)).rejects.toThrow();
  const row = await service().from('report_reads').select('suggestions, closed_at').eq('id', readId).single();
  expect(row.data!.suggestions).not.toBeNull();
  expect(row.data!.closed_at).toBeNull();
  expect((await service().storage.from('reports').list(`${TESTGALERIE}/${vehicleId}/${readId}`)).data).toHaveLength(1);

  await staff.close(readId, paths);
});

test('close fails for a read whose row does not exist', async () => {
  const api = createReportApi(await signedIn('staff@bambu.test'));
  await expect(api.close(crypto.randomUUID(), [`${TESTGALERIE}/${crypto.randomUUID()}/${crypto.randomUUID()}/1.pdf`])).rejects.toThrow('close_read_not_updated');
});

test('close can be repeated after the files are already gone', async () => {
  const vehicleId = crypto.randomUUID();
  await service().from('vehicles').insert({ id: vehicleId, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback' });
  const api = createReportApi(await signedIn('staff@bambu.test'));
  const readId = crypto.randomUUID();
  const paths = await api.upload(TESTGALERIE, vehicleId, readId, [{ bytes: PDF, mime: 'application/pdf', name: '1.pdf' }]);
  expect('suggestions' in (await api.read(vehicleId, readId, paths))).toBe(true);

  // A first close that got as far as deleting the files, then failed on the row.
  expect((await service().storage.from('reports').remove(paths)).error).toBeNull();
  await api.close(readId, paths);

  const row = await service().from('report_reads').select('suggestions, closed_at').eq('id', readId).single();
  expect(row.data!.suggestions).toBeNull();
  expect(row.data!.closed_at).not.toBeNull();
  expect((await service().storage.from('reports').list(`${TESTGALERIE}/${vehicleId}/${readId}`)).data).toEqual([]);
  await api.close(readId, paths); // and once more is harmless
});
