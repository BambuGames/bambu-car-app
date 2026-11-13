// What the studio shows and allows, from the photo rows the worker updates (design 5.6, 11.3).
import type { Slot } from '../domain/slots';
import type { Placement } from './geometry';

export type MaskEdit = { type: 'erase'; points: [number, number][]; radius: number } | { type: 'remove'; point: [number, number] };
export type ProcessStatus = 'unprocessed' | 'queued' | 'processing' | 'done' | 'failed';
export type PlateStatus = 'auto' | 'needs_check' | 'confirmed' | 'none';

export type StudioPhoto = {
  id: string;
  slot: Slot;
  process_status: ProcessStatus;
  process_error: string | null;
  output_path: string | null;
  output_wm_path: string | null;
  mask_path: string | null;
  original_path: string;
  captured_at: string;
  placement: Placement | null;
  plate_corners: [number, number][] | null;
  plate_status: PlateStatus | null;
  mask_edits: MaskEdit[];
  updated_at: string;
};

// Same as start_processing: a photo queued or processing for 10 minutes may be queued again.
export const STUCK_MS = 600_000;

export const isStuck = (p: StudioPhoto, now: number): boolean =>
  (p.process_status === 'queued' || p.process_status === 'processing') && now - Date.parse(p.updated_at) > STUCK_MS;

export function summarize(photos: StudioPhoto[], now: number) {
  const count = (test: (p: StudioPhoto) => boolean) => photos.filter(test).length;
  return {
    total: photos.length,
    done: count((p) => p.process_status === 'done'),
    failed: count((p) => p.process_status === 'failed'),
    running: count((p) => p.process_status === 'queued' || p.process_status === 'processing'),
    stuck: count((p) => isStuck(p, now)),
    unprocessed: count((p) => p.process_status === 'unprocessed'),
    plateChecks: count((p) => p.process_status === 'done' && (p.plate_status === 'auto' || p.plate_status === 'needs_check')),
  };
}

export type Blocker = 'offline' | 'uploading' | 'running' | 'nothing';

// Why "Bearbeiten" is off, or null when it may run. Photos still on the phone would be left out silently.
export function processBlocker(s: { online: boolean; pendingUploads: number; photos: StudioPhoto[]; now: number }): Blocker | null {
  if (!s.online) return 'offline';
  if (s.pendingUploads > 0) return 'uploading';
  const work = s.photos.some((p) => p.process_status === 'unprocessed' || p.process_status === 'failed' || isStuck(p, s.now));
  if (work) return null;
  return s.photos.some((p) => p.process_status === 'queued' || p.process_status === 'processing') ? 'running' : 'nothing';
}

// How long until the first running photo counts as stuck, so the studio can show "Erneut versuchen" then
// even when no event arrives (a dead worker sends none). null when nothing is waiting to become stuck.
export function msUntilStuck(photos: StudioPhoto[], now: number): number | null {
  const waits = photos
    .filter((p) => (p.process_status === 'queued' || p.process_status === 'processing') && !isStuck(p, now))
    .map((p) => STUCK_MS - (now - Date.parse(p.updated_at)));
  return waits.length > 0 ? Math.min(...waits) : null;
}

// A re-shoot uploads to the same storage path, so the image cache needs the capture time in its key.
export const originalKey = (p: StudioPhoto): string => `${p.original_path}#${p.captured_at}`;
