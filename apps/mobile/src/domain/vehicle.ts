export type BodyType = 'sedan' | 'kombi' | 'suv' | 'hatchback' | 'other';
export type VehicleStatus = 'draft' | 'shooting' | 'processing' | 'ready' | 'archived';

export type Vehicle = {
  id: string;
  galleryId: string;
  make: string;
  model: string;
  bodyType: BodyType;
  status: VehicleStatus;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
