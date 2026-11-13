// A vehicle's studio state, live: refetched on focus, when the app returns to the foreground and on every
// change of its photos or vehicle row (Realtime). Twenty-four photos at most, so a full refetch is cheap.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import { createStudioApi, type Studio } from './api';
import { subscribeStudio } from './realtime';
import { msUntilStuck } from './status';

export const studioApi = createStudioApi(supabase);

export function useStudio(vehicleId: string) {
  const [state, setState] = useState<{ data: Studio | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  // The time the screens judge "stuck" by. State, not Date.now() in render: the React Compiler may keep a
  // render-time value, and a dead worker sends no event that would render again.
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const data = await studioApi.fetchStudio(vehicleId);
      setState({ data, loading: false, error: null });
      setNow(Date.now());
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const unsubscribe = subscribeStudio(supabase, vehicleId, () => refresh());
      const app = AppState.addEventListener('change', (s) => {
        if (s === 'active') refresh();
      });
      return () => {
        app.remove();
        unsubscribe();
      };
    }, [vehicleId, refresh]),
  );

  // Wake up when the first running photo turns stuck, so "Erneut versuchen" shows without any event.
  useEffect(() => {
    const ms = state.data ? msUntilStuck(state.data.photos, Date.now()) : null;
    if (ms === null) return;
    const timer = setTimeout(() => setNow(Date.now()), ms + 1000);
    return () => clearTimeout(timer);
  }, [state.data]);

  return { ...state, refresh, now };
}
