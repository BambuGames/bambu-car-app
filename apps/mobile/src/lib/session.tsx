// Who is signed in, their gallery, and their on-device database.
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Db } from '../local/db';
import { deleteUserDb, openUserDb } from '../local/sqlite';
import { cachedMembership, refreshMembership, type Membership } from './membership';
import { supabase } from './supabase';

export type { Membership };

type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  // undefined: signed in, but the gallery is not known yet (never cached, server not reachable).
  membership: Membership | null | undefined;
  db: Db | null;
  retryMembership(): void;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

async function readMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('gallery_members')
    .select('gallery_id, role, galleries(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { galleryId: data.gallery_id, galleryName: data.galleries?.name ?? '', role: data.role } : null;
}

type Loaded = { userId: string; db: Db; membership: Membership | null | undefined };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Ask the server again whenever the app comes to the front: an admin may have added the person to a gallery.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && setAttempt((n) => n + 1));
    return () => subscription.remove();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setLoaded(null);
      return;
    }
    let cancelled = false;
    const show = (db: Db, membership: Membership | null | undefined) => {
      if (cancelled) return;
      setLoaded((prev) =>
        prev?.userId === userId && prev.db === db && JSON.stringify(prev.membership) === JSON.stringify(membership)
          ? prev
          : { userId, db, membership },
      );
    };
    (async () => {
      const db = await openUserDb(userId);
      // Start from what the device knows, so an offline start does not wait for the network.
      const cached = await cachedMembership(db);
      if (cached !== undefined) show(db, cached);
      show(db, await refreshMembership(db, () => readMembership(userId)));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const ready = session && loaded?.userId === session.user.id;
  const value: SessionState = {
    status: session === undefined || (session && !ready) ? 'loading' : session ? 'signedIn' : 'signedOut',
    user: session?.user ?? null,
    membership: ready ? loaded.membership : null,
    db: ready ? loaded.db : null,
    retryMembership: () => setAttempt((n) => n + 1),
    // Local sign-out keeps this user's database, so pending uploads continue after the next sign-in.
    signOut: async () => {
      await supabase.auth.signOut({ scope: 'local' });
    },
    // Once the server has deleted the account, nothing on the device may keep the person signed in.
    deleteAccount: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' });
      if (userId) await deleteUserDb(userId).catch((e) => console.warn('Could not delete the local database', e));
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
