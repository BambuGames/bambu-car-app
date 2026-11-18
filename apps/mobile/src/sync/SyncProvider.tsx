// Keeps the device database and Supabase in step and tells the screens what is still waiting.
// Sync runs after sign-in, when the app comes to the front, when the network returns, after every
// local change (screens call request()) and every 30 s while something waits and the app is in front.
// Screens reload through subscribe(), not through effect dependencies on the sync state: the React
// Compiler drops dependencies a callback never reads, and the reload silently stopped.
import { File } from 'expo-file-system';
import { useNetworkState } from 'expo-network';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import type { Db } from '../local/db';
import { createRemote } from './remote';
import { createSyncScheduler, type SyncScheduler } from './scheduler';
import { syncAndCount } from './sync';

type SyncState = { pending: number; failed: number; online: boolean; syncing: boolean } & Pick<
  SyncScheduler,
  'request' | 'subscribe'
>;

const SyncContext = createContext<SyncState | null>(null);
const RETRY_MS = 30_000;

export function SyncProvider({ db, galleryId, children }: { db: Db; galleryId: string; children: ReactNode }) {
  const network = useNetworkState();
  // Unknown counts as online: a failed attempt only costs a retry.
  const online = network.isInternetReachable ?? network.isConnected ?? true;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const [queue, setQueue] = useState({ pending: 0, failed: 0 });
  const [syncing, setSyncing] = useState(false);

  // The catalog is fetched again once per app start, so makes added on the server reach installed apps.
  // ponytail: cleared on the first online attempt, not its success; a failed fetch waits for the next start.
  const refreshCatalog = useRef(true);

  const scheduler = useMemo(() => {
    const remote = createRemote(supabase, (uri) => new File(uri).arrayBuffer());
    return createSyncScheduler(async () => {
      const online = onlineRef.current;
      const refresh = online && refreshCatalog.current;
      if (refresh) refreshCatalog.current = false;
      setSyncing(online);
      try {
        setQueue(await syncAndCount(db, remote, galleryId, Date.now, online, refresh));
      } finally {
        setSyncing(false);
      }
    });
  }, [db, galleryId]);
  const { request, subscribe } = scheduler;

  useEffect(() => {
    request();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && request());
    return () => subscription.remove();
  }, [request]);

  useEffect(() => {
    if (online) request();
  }, [online, request]);

  const waiting = queue.pending + queue.failed > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => AppState.currentState === 'active' && request(), RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, request]);

  const value = useMemo(
    () => ({ ...queue, online, syncing, request, subscribe }),
    [queue, online, syncing, request, subscribe],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}
