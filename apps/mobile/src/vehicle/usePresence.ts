// Is this vehicle open on another device? A private realtime channel per vehicle, presence only.
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';

import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { getMeta, setMeta } from '../local/meta';
import { useSync } from '../sync/SyncProvider';
import { othersEditing, type PresenceState } from './presence';

// ponytail: a random id per install; reinstalling makes a new device, which is what it is.
async function deviceId(db: NonNullable<ReturnType<typeof useSession>['db']>) {
  const stored = await getMeta(db, 'deviceId');
  if (stored) return stored;
  const fresh = randomUUID();
  await setMeta(db, 'deviceId', fresh);
  return fresh;
}

// null: offline or the channel could not be joined. []: joined and nobody else is here.
export function useEditingElsewhere(vehicleId: string): string[] | null {
  const { db, user } = useSession();
  const { online } = useSync();
  const [names, setNames] = useState<string[] | null>(null);
  const email = user?.email;

  useEffect(() => {
    if (!db || !online || !vehicleId) {
      setNames(null);
      return;
    }
    let active = true;
    let cleanup = () => {};
    deviceId(db).then((device) => {
      if (!active) return;
      const name = (email ?? '').split('@')[0];
      const channel = supabase.channel(`vehicle:${vehicleId}`, { config: { private: true, presence: { key: device } } });
      const sync = () => active && setNames(othersEditing(channel.presenceState() as PresenceState, device));
      channel
        .on('presence', { event: 'sync' }, sync)
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') channel.track({ device, name });
          else setNames(null);
        });
      cleanup = () => {
        channel.untrack();
        supabase.removeChannel(channel);
      };
    }).catch(() => active && setNames(null));
    return () => {
      active = false;
      cleanup();
    };
  }, [db, online, vehicleId, email]);

  return names;
}
