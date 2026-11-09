// Shot list steps. Exterior ids match tools/templates (walking order around the car).
export const EXTERIOR_SLOTS = [
  'front_left_45', 'front', 'front_right_45', 'right', 'rear_right_45', 'rear', 'rear_left_45', 'left',
] as const;
export const DETAIL_SLOTS = [
  'detail_wheel', 'detail_headlights', 'detail_taillights', 'detail_trunk_open', 'detail_engine', 'detail_roof', 'detail_other',
] as const;
export const INTERIOR_SLOTS = [
  'interior_cockpit', 'interior_console', 'interior_instruments', 'interior_front_seats', 'interior_rear_seats',
  'interior_door', 'interior_trunk', 'interior_headliner', 'interior_other',
] as const;

export type Slot = (typeof EXTERIOR_SLOTS)[number] | (typeof DETAIL_SLOTS)[number] | (typeof INTERIOR_SLOTS)[number];

export const isExterior = (slot: Slot): boolean => (EXTERIOR_SLOTS as readonly Slot[]).includes(slot);
