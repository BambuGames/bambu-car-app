import type { DamagePart } from '../domain/vehicleData';

// Top-down car in a 1000x500 box, front at the left. "Left" is the driver's left, so it is the lower side.
// Parts sit 5 units apart so the gaps read as panel seams.
export const PART_PATHS: Record<DamagePart, string> = {
  bumper_front: 'M125 110 L95 112 Q38 125 38 250 Q38 375 95 388 L125 390 Z',
  hood: 'M135 120 L335 105 L335 395 L135 380 Z',
  fender_front_right: 'M135 72 L335 60 L335 100 L135 115 Z',
  fender_front_left: 'M135 385 L335 400 L335 440 L135 428 Z',
  door_front_right: 'M342 60 L505 60 L505 128 L342 128 Z',
  door_front_left: 'M342 372 L505 372 L505 440 L342 440 Z',
  door_rear_right: 'M512 60 L675 60 L675 128 L512 128 Z',
  door_rear_left: 'M512 372 L675 372 L675 440 L512 440 Z',
  roof: 'M342 135 L675 135 L675 365 L342 365 Z',
  sill_right: 'M342 30 L675 30 L675 54 L342 54 Z',
  sill_left: 'M342 446 L675 446 L675 470 L342 470 Z',
  quarter_rear_right: 'M682 60 L865 72 L865 128 L682 128 Z',
  quarter_rear_left: 'M682 372 L865 372 L865 428 L682 440 Z',
  trunk: 'M682 135 L865 135 L865 365 L682 365 Z',
  bumper_rear: 'M872 112 L905 112 Q962 125 962 250 Q962 375 905 388 L872 388 Z',
};
