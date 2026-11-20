// The studio's server calls (M2a: process-vehicle, photo and vehicle columns, signed URLs). Online only.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '../lib/database.types';
import type { Point } from './geometry';
import type { MaskEdit, StudioPhoto } from './status';

export type BackgroundSpec = { kind: 'studio'; wall: string; floor: string } | { kind: 'image'; path: string };
export type Background = { id: string; gallery_id: string | null; name: string; spec: BackgroundSpec; sort_order: number };
export type StudioVehicle = {
  id: string;
  gallery_id: string;
  status: string;
  background_id: string | null;
  tone_enabled: boolean;
  credit_charged_at: string | null;
  gallery: { default_background_id: string | null } | null;
};
export type Studio = { vehicle: StudioVehicle; photos: StudioPhoto[]; backgrounds: Background[] };
export type ProcessError = 'no_credit' | 'photo_limit' | 'not_member' | 'not_owner' | 'offline' | 'internal';

const PHOTO_COLUMNS =
  'id, slot, process_status, process_error, output_path, output_wm_path, mask_path, original_path, captured_at, placement, plate_corners, plate_status, mask_edits, updated_at';
const HTTP_ERRORS: Record<number, ProcessError> = { 402: 'no_credit', 409: 'photo_limit', 403: 'not_member' };

function check<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

export function createStudioApi(client: SupabaseClient<Database>) {
  return {
    async fetchStudio(vehicleId: string): Promise<Studio> {
      const [vehicle, photos, backgrounds] = await Promise.all([
        client
          .from('vehicles')
          .select('id, gallery_id, status, background_id, tone_enabled, credit_charged_at, gallery:galleries(default_background_id)')
          .eq('id', vehicleId)
          .single(),
        client.from('photos').select(PHOTO_COLUMNS).eq('vehicle_id', vehicleId),
        client.from('backgrounds').select('id, gallery_id, name, spec, sort_order').order('sort_order'),
      ]);
      return {
        vehicle: check(vehicle) as StudioVehicle,
        photos: check(photos) as unknown as StudioPhoto[],
        backgrounds: check(backgrounds) as unknown as Background[],
      };
    },

    async signedUrls(bucket: 'originals' | 'processed' | 'branding', paths: string[], seconds = 3600): Promise<Record<string, string>> {
      if (paths.length === 0) return {};
      const rows = check(await client.storage.from(bucket).createSignedUrls(paths, seconds)) ?? [];
      return Object.fromEntries(rows.flatMap((r) => (r.signedUrl && r.path ? [[r.path, r.signedUrl] as const] : [])));
    },

    async startProcessing(body: { vehicleId: string; photoId?: string; rerender?: boolean }): Promise<{ queued: string[] } | { error: ProcessError }> {
      const { data, error } = await client.functions.invoke<{ queued: string[] }>('process-vehicle', { body });
      if (!error) return { queued: data?.queued ?? [] };
      if (error instanceof FunctionsHttpError) {
        const answer = error.context as Response;
        // Both 403s: another gallery's vehicle (not_member) and a vehicle only the owner may pay for (not_owner).
        const body = (await answer.json().catch(() => null)) as { error?: unknown } | null;
        if (body?.error === 'not_owner') return { error: 'not_owner' };
        return { error: HTTP_ERRORS[answer.status] ?? 'internal' };
      }
      // Only a request that never reached the function is offline; a relay error means it crashed or would not start.
      return { error: error instanceof FunctionsFetchError ? 'offline' : 'internal' };
    },

    /** Queues one photo again (a plate or touch-up fix); throws the reason when it could not be queued. */
    async renderPhoto(vehicleId: string, photoId: string): Promise<void> {
      const result = await this.startProcessing({ vehicleId, photoId });
      if ('error' in result) throw new Error(result.error);
    },

    async setStudioOptions(vehicleId: string, options: { backgroundId?: string; toneEnabled?: boolean }): Promise<void> {
      const fields: { background_id?: string; tone_enabled?: boolean } = {};
      if (options.backgroundId !== undefined) fields.background_id = options.backgroundId;
      if (options.toneEnabled !== undefined) fields.tone_enabled = options.toneEnabled;
      check(await client.from('vehicles').update(fields).eq('id', vehicleId));
    },

    async saveMaskEdits(photoId: string, edits: MaskEdit[]): Promise<void> {
      check(await client.from('photos').update({ mask_edits: edits as unknown as NonNullable<Json> }).eq('id', photoId));
    },

    async savePlate(photoId: string, corners: Point[] | null, status: 'confirmed' | 'none'): Promise<void> {
      const plate_corners = corners ? (corners.map((p) => [p.x, p.y]) as unknown as Json) : null;
      check(await client.from('photos').update({ plate_corners, plate_status: status }).eq('id', photoId));
    },
  };
}

export type StudioApi = ReturnType<typeof createStudioApi>;

/** Stores a touch-up and queues the photo's re-render. When it cannot be queued, the earlier edits go back,
 *  so leaving the editor leaves the row as it was; throws the reason (a ProcessError as the message). */
export async function saveAndRender(
  api: Pick<StudioApi, 'saveMaskEdits' | 'renderPhoto'>,
  a: { vehicleId: string; photoId: string; edits: MaskEdit[]; previous: MaskEdit[] },
): Promise<void> {
  await api.saveMaskEdits(a.photoId, a.edits);
  try {
    await api.renderPhoto(a.vehicleId, a.photoId);
  } catch (e) {
    await api.saveMaskEdits(a.photoId, a.previous).catch(() => {});
    throw e;
  }
}

const PROCESS_ERRORS: readonly string[] = ['no_credit', 'photo_limit', 'not_member', 'not_owner', 'offline', 'internal'] satisfies ProcessError[];

/** The reason to show for a failed studio call: the ProcessError it carries, else offline or internal. */
export function processErrorOf(e: unknown, online: boolean): ProcessError {
  const reason = e instanceof Error ? e.message : '';
  return PROCESS_ERRORS.includes(reason) ? (reason as ProcessError) : online ? 'internal' : 'offline';
}

/**
 * Starts processing; on success refreshes the studio and asks for a sync, so the vehicle list (read from the
 * phone's database) leaves "Waiting for processing" at once (M5). Returns the reason when it did not start.
 */
export async function startAndSync(
  api: Pick<StudioApi, 'startProcessing'>,
  body: { vehicleId: string; photoId?: string; rerender?: boolean },
  after: { refresh: () => void; request: () => void },
): Promise<ProcessError | null> {
  const result = await api.startProcessing(body);
  if ('error' in result) return result.error;
  after.refresh();
  after.request();
  return null;
}
