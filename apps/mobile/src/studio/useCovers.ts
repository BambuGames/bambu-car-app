// Cover thumbnails for the vehicle list. Online only: offline the list simply shows no pictures.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '../lib/supabase';
import { readAll } from '../sync/remote';
import { coversByVehicle } from './order';
import { studioApi } from './useStudio';

export type Cover = { url: string; path: string };

// The last covers per gallery, so a screen opened after the list starts with them (no placeholder that jumps
// to a photo a moment later) and then refreshes quietly.
const lastCovers = new Map<string, Record<string, Cover | null>>();

export function useCovers(galleryId: string | undefined): Record<string, Cover | null> {
  const [covers, setCovers] = useState<Record<string, Cover | null>>(() => (galleryId && lastCovers.get(galleryId)) || {});
  useFocusEffect(
    useCallback(() => {
      if (!galleryId) return;
      let active = true;
      (async () => {
        try {
          // Every processed photo of the gallery, page by page (PostgREST stops at 1000 rows, about 50 cars).
          const data = await readAll((from, to) =>
            supabase
              .from('photos')
              .select('vehicle_id, slot, process_status, output_path')
              .eq('gallery_id', galleryId)
              .eq('process_status', 'done')
              .order('id')
              .range(from, to),
          );
          const paths = coversByVehicle(data as Parameters<typeof coversByVehicle>[0]);
          const urls = await studioApi.signedUrls('processed', Object.values(paths).filter((p): p is string => !!p));
          const next = Object.fromEntries(Object.entries(paths).map(([id, p]) => [id, p && urls[p] ? { url: urls[p], path: p } : null]));
          lastCovers.set(galleryId, next);
          if (!active) return;
          setCovers(next);
        } catch {
          // offline or not reachable: no thumbnails
        }
      })();
      return () => {
        active = false;
      };
    }, [galleryId]),
  );
  return covers;
}
