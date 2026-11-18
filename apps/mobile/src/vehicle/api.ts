import type { BodyType } from '../domain/vehicle';
import type { Db } from '../local/db';
import type { OutboxKind } from '../local/outbox';
import type { ProcessError } from '../studio/api';
import { getVehicle, updateVehicle } from '../local/vehicles';

type Deps = {
  db: Db;
  flush: (entities: { kind: OutboxKind; id: string }[]) => Promise<boolean>;
  confirm: () => Promise<boolean>;
  startProcessing: (body: { vehicleId: string; rerender: true }) => Promise<{ queued: string[] } | { error: ProcessError }>;
};

export type BodyTypeResult = 'saved' | 'rerendered' | 'offline' | Exclude<ProcessError, 'offline'>;

/** Saves the body type; a processed set is re-rendered for free (no credit) once the dealer confirms.
 *  Whether the set is processed is decided after the flush: its pull brings the server's status, which the phone
 *  may not have yet (the studio does not sync). A failed re-render returns its error code (the change stays saved). */
export async function changeBodyType(deps: Deps, vehicleId: string, bodyType: BodyType, now: string): Promise<BodyTypeResult> {
  await updateVehicle(deps.db, vehicleId, { bodyType }, now);
  const sent = await deps.flush([{ kind: 'vehicle', id: vehicleId }]);
  const status = (await getVehicle(deps.db, vehicleId))?.status;
  if (status !== 'ready' && status !== 'processing') return 'saved';
  if (!sent) return 'offline';
  if (!(await deps.confirm())) return 'saved';
  const result = await deps.startProcessing({ vehicleId, rerender: true });
  if ('error' in result) return result.error;
  return 'rerendered';
}
