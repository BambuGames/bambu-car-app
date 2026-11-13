// Listing order and cover photo (design 2.1/6): the exterior walk, then details, then interior. The cover is
// the first processed photo in that order; M2c names exported files in the same order.
import { DETAIL_SLOTS, EXTERIOR_SLOTS, INTERIOR_SLOTS, type Slot } from '../domain/slots';
import type { StudioPhoto } from './status';

export const LISTING_ORDER: readonly Slot[] = [...EXTERIOR_SLOTS, ...DETAIL_SLOTS, ...INTERIOR_SLOTS];

export function orderPhotos<T extends { slot: Slot }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => LISTING_ORDER.indexOf(a.slot) - LISTING_ORDER.indexOf(b.slot));
}

export function coverPhoto<T extends { slot: Slot; process_status: string }>(photos: T[]): T | null {
  return orderPhotos(photos).find((p) => p.process_status === 'done') ?? null;
}

// Each vehicle's cover from a gallery-wide list of photo rows: vehicle id → output path, or null.
export function coversByVehicle(
  rows: { vehicle_id: string; slot: Slot; process_status: string; output_path: string | null }[],
): Record<string, string | null> {
  const byVehicle = new Map<string, typeof rows>();
  for (const r of rows) byVehicle.set(r.vehicle_id, [...(byVehicle.get(r.vehicle_id) ?? []), r]);
  return Object.fromEntries([...byVehicle].map(([id, photos]) => [id, coverPhoto(photos)?.output_path ?? null]));
}

const needsCheck = (p: StudioPhoto) => p.process_status === 'done' && (p.plate_status === 'auto' || p.plate_status === 'needs_check');

/** The plate quick check's photos in listing order. `done`: handled on this screen (Realtime may lag a moment
 * behind). `retry`: a fix was saved but its re-render could not be queued, so the photo stays until it is. */
export function plateQueue(photos: StudioPhoto[], s: { photoId?: string; done: string[]; retry: string | null }): StudioPhoto[] {
  return orderPhotos(photos).filter((p) =>
    s.photoId ? p.id === s.photoId && !s.done.includes(p.id) : p.id === s.retry || (needsCheck(p) && !s.done.includes(p.id)),
  );
}
