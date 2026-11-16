import { FunctionsFetchError, FunctionsRelayError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { createStudioApi, saveAndRender } from './api';
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
