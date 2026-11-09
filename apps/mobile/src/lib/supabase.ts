import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    // postgrest-js retries a failed read 3 times (1 + 2 + 4 s) before giving up. Without a connection that
    // kept the app on a blank screen for about 9 s at startup, until the cached membership was used. The
    // sync outbox has its own backoff, so a failed request should fail at once.
    db: { retry: false },
  },
);

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
