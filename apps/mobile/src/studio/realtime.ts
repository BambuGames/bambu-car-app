// Live updates for one vehicle's studio: its photos and its vehicle row. Returns the unsubscribe.
// Every subscription gets its own topic: the client hands back an existing channel for a known topic, also
// one still leaving after the previous screen closed, and a leaving channel never joins again. The topic is
// only a name on this client; the filters below decide what arrives.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';

export function subscribeStudio(client: SupabaseClient<Database>, vehicleId: string, onChange: () => void): () => void {
  const channel = client
    .channel(`studio:${vehicleId}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `vehicle_id=eq.${vehicleId}` }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles', filter: `id=eq.${vehicleId}` }, () => onChange())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange(); // a reconnect may have missed changes
    });
  return () => {
    client.removeChannel(channel);
  };
}
