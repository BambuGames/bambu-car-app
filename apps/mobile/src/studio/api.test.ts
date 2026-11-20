import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { createStudioApi, saveAndRender, startAndSync } from './api';
import type { MaskEdit } from './status';

const clientWhoseFunctionFails = (error: Error) =>
  ({ functions: { invoke: async () => ({ data: null, error }) } }) as unknown as SupabaseClient<Database>;

test('a crashed function reads as an internal error, not as offline', async () => {
  const api = createStudioApi(clientWhoseFunctionFails(new FunctionsRelayError({})));
  expect(await api.startProcessing({ vehicleId: 'v' })).toEqual({ error: 'internal' });
});

test('a request that never reached the function reads as offline', async () => {
  const api = createStudioApi(clientWhoseFunctionFails(new FunctionsFetchError({})));
  expect(await api.startProcessing({ vehicleId: 'v' })).toEqual({ error: 'offline' });
});

// The function's answer body, as functions.invoke hands it over in error.context.
const answered = (status: number, body: unknown) =>
  new FunctionsHttpError({ status, json: async () => body });

test('a 403 with not_owner maps to not_owner', async () => {
  const api = createStudioApi(clientWhoseFunctionFails(answered(403, { error: 'not_owner' })));
  expect(await api.startProcessing({ vehicleId: 'v' })).toEqual({ error: 'not_owner' });
});

test('a 403 without not_owner stays not_member', async () => {
  const api = createStudioApi(clientWhoseFunctionFails(answered(403, { error: 'not_member' })));
  expect(await api.startProcessing({ vehicleId: 'v' })).toEqual({ error: 'not_member' });
  const unreadable = new FunctionsHttpError({ status: 403, json: async () => { throw new Error('no body'); } });
  expect(await createStudioApi(clientWhoseFunctionFails(unreadable)).startProcessing({ vehicleId: 'v' })).toEqual({ error: 'not_member' });
});

const earlier: MaskEdit[] = [{ type: 'remove', point: [0.1, 0.1] }];
const added: MaskEdit[] = [...earlier, { type: 'remove', point: [0.5, 0.5] }];

function fakeApi(render: () => Promise<void>) {
  const saved: MaskEdit[][] = [];
  return { saved, api: { saveMaskEdits: async (_photoId: string, edits: MaskEdit[]) => void saved.push(edits), renderPhoto: render } };
}

test('a touch-up whose re-render fails puts the earlier edits back', async () => {
  const { saved, api } = fakeApi(async () => {
    throw new Error('no_credit');
  });
  await expect(saveAndRender(api, { vehicleId: 'v', photoId: 'p', edits: added, previous: earlier })).rejects.toThrow('no_credit');
  expect(saved).toEqual([added, earlier]);
});

test('a touch-up that is queued keeps its edits', async () => {
  const { saved, api } = fakeApi(async () => {});
  await saveAndRender(api, { vehicleId: 'v', photoId: 'p', edits: added, previous: earlier });
  expect(saved).toEqual([added]);
});

// M5 final review: after the owner's start, the vehicle list must leave "Waiting for processing" at once.
test('a started processing refreshes the studio and asks for a sync', async () => {
  const calls: string[] = [];
  const api = { startProcessing: async () => ({ queued: ['p1'] }) };
  const error = await startAndSync(api, { vehicleId: 'v' }, { refresh: () => calls.push('refresh'), request: () => calls.push('request') });
  expect(error).toBeNull();
  expect(calls).toEqual(['refresh', 'request']);
});

test('a refused start reports its reason and asks for nothing', async () => {
  const calls: string[] = [];
  const api = { startProcessing: async () => ({ error: 'not_owner' as const }) };
  const error = await startAndSync(api, { vehicleId: 'v' }, { refresh: () => calls.push('refresh'), request: () => calls.push('request') });
  expect(error).toBe('not_owner');
  expect(calls).toEqual([]);
});
