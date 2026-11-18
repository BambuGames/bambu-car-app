// Value lists follow the mobile.de upload interface. Keep in sync with
// supabase/functions/_shared/vehicleData.ts (a test compares them) and the CHECK lists in the migration.
export const FUELS = ['petrol', 'diesel', 'lpg', 'cng', 'electric', 'hybrid_petrol', 'hybrid_diesel', 'hydrogen', 'ethanol', 'other'] as const;
export const TRANSMISSIONS = ['manual', 'semi_automatic', 'automatic'] as const;
export const DRIVES = ['front', 'rear', 'all'] as const;
export const EXTERIOR_COLORS = ['beige', 'black', 'blue', 'brown', 'gold', 'green', 'grey', 'orange', 'purple', 'red', 'silver', 'white', 'yellow'] as const;
export const INTERIOR_COLORS = ['black', 'grey', 'beige', 'brown', 'other'] as const;
export const UPHOLSTERIES = ['full_leather', 'part_leather', 'cloth', 'velour', 'alcantara', 'other'] as const;
export const EQUIPMENT = [
  'abs', 'esp', 'traction_control', 'immobiliser', 'central_locking',
  'parking_sensors_front', 'parking_sensors_rear', 'parking_camera', 'park_assist',
  'navigation', 'bluetooth', 'onboard_computer', 'cd_player', 'radio', 'mp3_interface', 'hands_free', 'head_up_display',
  'sunroof', 'panorama_roof', 'electric_windows', 'electric_mirrors',
  'power_steering', 'cruise_control', 'multifunction_wheel',
  'electric_seats', 'sport_seats',
  'trailer_coupling', 'roof_rack', 'ski_bag', 'isofix',
  'alloy_wheels', 'xenon_headlights', 'cornering_lights', 'fog_lights', 'daytime_running_lights', 'light_sensor', 'rain_sensor',
  'seat_heating', 'auxiliary_heating', 'start_stop',
  'sport_package', 'metallic', 'air_conditioning', 'climate_control',
] as const;
export const DAMAGE_PARTS = [
  'hood', 'roof', 'trunk', 'bumper_front', 'bumper_rear',
  'fender_front_left', 'fender_front_right', 'door_front_left', 'door_front_right',
  'door_rear_left', 'door_rear_right', 'quarter_rear_left', 'quarter_rear_right', 'sill_left', 'sill_right',
] as const;
export const DAMAGE_STATES = ['original', 'painted', 'partly_painted', 'replaced', 'damaged'] as const;
export const LANGUAGES = ['de', 'tr', 'en'] as const;

export type Fuel = (typeof FUELS)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type Drive = (typeof DRIVES)[number];
export type ExteriorColor = (typeof EXTERIOR_COLORS)[number];
export type InteriorColor = (typeof INTERIOR_COLORS)[number];
export type Upholstery = (typeof UPHOLSTERIES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type DamagePart = (typeof DAMAGE_PARTS)[number];
export type DamageState = (typeof DAMAGE_STATES)[number];
export type Language = (typeof LANGUAGES)[number];

export type VehicleData = {
  variant: string | null;
  firstRegistration: string | null; // YYYY-MM-01
  mileageKm: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  powerKw: number | null;
  displacementCcm: number | null;
  drive: Drive | null;
  colorExterior: ExteriorColor | null;
  colorInterior: InteriorColor | null;
  upholstery: Upholstery | null;
  previousOwners: number | null;
  huUntil: string | null; // YYYY-MM-01
  accidentFree: boolean | null;
  serviceBook: boolean | null;
  nonSmoker: boolean | null;
  vin: string | null;
};
export type DamageMap = Partial<Record<DamagePart, Exclude<DamageState, 'original'>>>;
export type VehicleDetails = { equipment?: Equipment[]; notes?: string };

export const emptyVehicleData = (): VehicleData => ({
  variant: null, firstRegistration: null, mileageKm: null, fuel: null, transmission: null, powerKw: null,
  displacementCcm: null, drive: null, colorExterior: null, colorInterior: null, upholstery: null,
  previousOwners: null, huUntil: null, accidentFree: null, serviceBook: null, nonSmoker: null, vin: null,
});

const oneOf = (list: readonly string[]) => (v: unknown) => typeof v === 'string' && list.includes(v);
const int = (min: number, max: number) => (v: unknown) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const month = (v: unknown) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(v);
const bool = (v: unknown) => typeof v === 'boolean';

const CHECKS: Record<keyof VehicleData, (v: unknown) => boolean> = {
  variant: (v) => typeof v === 'string' && v.length <= 120,
  firstRegistration: month,
  mileageKm: int(0, 2_000_000),
  fuel: oneOf(FUELS),
  transmission: oneOf(TRANSMISSIONS),
  powerKw: int(1, 2000),
  displacementCcm: int(1, 20000),
  drive: oneOf(DRIVES),
  colorExterior: oneOf(EXTERIOR_COLORS),
  colorInterior: oneOf(INTERIOR_COLORS),
  upholstery: oneOf(UPHOLSTERIES),
  previousOwners: int(0, 50),
  huUntil: month,
  accidentFree: bool,
  serviceBook: bool,
  nonSmoker: bool,
  // VIN alphabet excludes I, O, Q; input case does not matter.
  vin: (v) => typeof v === 'string' && /^[A-HJ-NPR-Z0-9]{17}$/.test(v.toUpperCase()),
};

/** Null/undefined means "not filled in" and is valid. */
export function validateVehicleData(d: Partial<VehicleData>): Partial<Record<keyof VehicleData, 'invalid'>> {
  const out: Partial<Record<keyof VehicleData, 'invalid'>> = {};
  for (const key of Object.keys(CHECKS) as (keyof VehicleData)[]) {
    const v = d[key];
    if (v != null && !CHECKS[key](v)) out[key] = 'invalid';
  }
  return out;
}

export const kwToPs = (kw: number): number => Math.round(kw * 1.35962);

export const monthOf = (date: string | null): string | null => (date ? `${date.slice(0, 7)}-01` : null);
