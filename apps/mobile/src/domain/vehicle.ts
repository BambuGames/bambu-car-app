import type { DamageMap, VehicleData, VehicleDetails } from './vehicleData';

export type BodyType = 'sedan' | 'kombi' | 'suv' | 'hatchback' | 'other';
export type VehicleStatus = 'draft' | 'shooting' | 'processing' | 'ready' | 'archived';

export type Vehicle = {
  id: string;
  galleryId: string;
  make: string;
  model: string;
  bodyType: BodyType;
  status: VehicleStatus;
  data: VehicleData;
  damage: DamageMap;
  damageCheckedAt: string | null;
  details: VehicleDetails;
  createdAt: string;
  updatedAt: string;
  factsUpdatedAt: string; // last change of what the listing text is written from (see local/vehicles.ts)
};
