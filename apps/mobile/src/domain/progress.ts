// What a vehicle still needs, and what the upload line under the list header says.
import { EXTERIOR_SLOTS, type Slot } from './slots';

// Exterior slots without a photo, in walking order around the car.
export function missingExterior(photos: { slot: Slot }[]): Slot[] {
  const taken = new Set(photos.map((p) => p.slot));
  return EXTERIOR_SLOTS.filter((slot) => !taken.has(slot));
}

export function uploadSummary(s: { pending: number; failed: number; online: boolean }): { key: string; count: number } | null {
  if (s.pending + s.failed === 0) return null;
  if (!s.online) return { key: 'sync.offlinePending', count: s.pending + s.failed };
  return s.failed > 0 ? { key: 'sync.retrying', count: s.failed } : { key: 'sync.uploading', count: s.pending };
}
