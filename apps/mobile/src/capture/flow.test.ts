import { EXTERIOR_SLOTS } from '../domain/slots';
import { nextSlot } from './flow';

test('nextSlot moves to the next missing step of the same section and wraps', () => {
  expect(nextSlot('front', [{ slot: 'front_left_45' }, { slot: 'front' }])).toBe('front_right_45');
  expect(nextSlot('left', [{ slot: 'left' }])).toBe('front_left_45');
  expect(nextSlot('detail_wheel', [{ slot: 'detail_wheel' }])).toBe('detail_headlights');
  expect(nextSlot('front', EXTERIOR_SLOTS.map((slot) => ({ slot })))).toBeNull();
});

test('nextSlot skips steps already taken', () => {
  expect(nextSlot('front_left_45', [{ slot: 'front_left_45' }, { slot: 'front' }, { slot: 'front_right_45' }])).toBe('right');
  expect(nextSlot('interior_other', [{ slot: 'interior_other' }, { slot: 'interior_cockpit' }])).toBe('interior_console');
});
