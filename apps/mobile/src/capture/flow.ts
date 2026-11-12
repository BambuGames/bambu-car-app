import { DETAIL_SLOTS, EXTERIOR_SLOTS, INTERIOR_SLOTS, type Slot } from '../domain/slots';

const SECTIONS: readonly (readonly Slot[])[] = [EXTERIOR_SLOTS, DETAIL_SLOTS, INTERIOR_SLOTS];

// After a photo: the next missing step of the same section, in walking order and wrapping round; null when the
// section is complete.
export function nextSlot(current: Slot, photos: { slot: Slot }[]): Slot | null {
  const section = SECTIONS.find((s) => s.includes(current))!;
  const taken = new Set(photos.map((p) => p.slot));
  const start = section.indexOf(current);
  for (let i = 1; i <= section.length; i++) {
    const slot = section[(start + i) % section.length];
    if (!taken.has(slot)) return slot;
  }
  return null;
}
