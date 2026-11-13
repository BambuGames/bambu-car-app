import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { subscribeStudio } from './realtime';

// Records the topics asked for. The Realtime client hands back an existing channel for a topic it already
// has, even one still leaving, so two screens on the same topic would share (and lose) one subscription.
function fakeClient() {
  const topics: string[] = [];
  const client = {
    channel(topic: string) {
      topics.push(topic);
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: () => Promise.resolve('ok'),
  };
  return { client: client as unknown as SupabaseClient<Database>, topics };
}

test('each studio screen listens on its own channel', () => {
  const { client, topics } = fakeClient();
  subscribeStudio(client, 'v1', () => {});
  subscribeStudio(client, 'v1', () => {});
  expect(topics).toHaveLength(2);
  expect(topics[0]).not.toBe(topics[1]);
});
