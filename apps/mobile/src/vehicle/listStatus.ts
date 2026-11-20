import { EXTERIOR_SLOTS } from '../domain/slots';
import type { VehicleListItem } from '../local/vehicles';

/**
 * The translation key for a vehicle's state in the list (M5). A vehicle whose exterior is all shot and uploaded
 * waits for the owner, who alone starts the processing that charges the credit.
 */
export function listStatusKey(v: Pick<VehicleListItem, 'status' | 'exteriorDone' | 'pendingUploads'>): string {
  if (v.status === 'shooting' && v.exteriorDone === EXTERIOR_SLOTS.length && v.pendingUploads === 0) {
    return 'vehicles.waitingForProcessing';
  }
  return `vehicles.status.${v.status}`;
}
