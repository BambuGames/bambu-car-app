// Turns the suggestions the dealer accepted into a vehicle patch. Anything the value lists do not allow is
// skipped; damageCheckedAt stays as it was (a report is not the dealer's own check of the whole car).
import type { Vehicle } from '../domain/vehicle';
import { validateVehicleData, type VehicleData } from '../domain/vehicleData';
import type { VehiclePatch } from '../local/vehicles';
import { setPartState } from '../vehicle/damage';
import type { Suggestion } from './api';

export function applySuggestions(vehicle: Vehicle, accepted: Suggestion[]): VehiclePatch {
  const data: Partial<VehicleData> = {};
  let damage = vehicle.damage;
  let damaged = false;
  const equipment = [...(vehicle.details.equipment ?? [])];
  let equipped = false;
  const patch: VehiclePatch = {};

  for (const s of accepted) {
    if (s.kind === 'damage') {
      damage = setPartState(damage, s.part, s.state);
      damaged = true;
    } else if (s.kind === 'equipment') {
      if (!equipment.includes(s.code)) equipment.push(s.code);
      equipped = true;
    } else if (s.field === 'make' || s.field === 'model') {
      if (typeof s.value === 'string' && s.value.trim()) patch[s.field] = s.value.trim();
    } else if (Object.keys(validateVehicleData({ [s.field]: s.value })).length === 0) {
      Object.assign(data, { [s.field]: s.value });
    }
  }
  patch.data = data as VehicleData; // partial on purpose: updateVehicle merges field by field
  if (damaged) patch.damage = damage;
  if (equipped) patch.details = { equipment };
  return patch;
}
