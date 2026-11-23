import { EXTERIOR_SLOTS } from '../domain/slots';
import type { VehicleListItem } from '../local/vehicles';

// The one-line state a vehicle shows in the list and on its page (spec §12.3). `mark` is the next step the
// user has to take; interior shots and vehicle data do not count here.
export type VehicleState = {
  tone: 'ok' | 'wait' | 'mark' | 'neutral';
  key: string;
  params?: Record<string, number>;
  meter?: { done: number; total: number };
};

export function stateLine(v: Pick<VehicleListItem, 'status' | 'exteriorDone' | 'pendingUploads'>): VehicleState {
  const total = EXTERIOR_SLOTS.length;
  if (v.status === 'ready') return { tone: 'ok', key: 'vehicles.status.ready' };
  if (v.status === 'processing') return { tone: 'wait', key: 'vehicles.status.processing' };
  if (v.pendingUploads > 0) return { tone: 'wait', key: 'vehicles.pendingUploads', params: { count: v.pendingUploads } };
  if (v.status === 'shooting' && v.exteriorDone < total) {
    const done = v.exteriorDone;
    return { tone: 'mark', key: 'vehicles.exteriorMissing', params: { done, total, missing: total - done }, meter: { done, total } };
  }
  if (v.status === 'shooting') return { tone: 'wait', key: 'vehicles.waitingForProcessing' };
  return { tone: 'neutral', key: 'vehicles.noPhotos' };
}
