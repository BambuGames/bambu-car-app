import { TEMPLATES } from '../templates/templates.generated';
import { EXTERIOR_SLOTS } from './slots';
import { templateFor, wideAllowed } from './templates';

test('templateFor returns the body type silhouette', () => {
  const t = templateFor('kombi', 'front_left_45', 'normal')!;
  expect(t.path).toMatch(/^M /);
  expect(t.box.x0).toBeLessThan(t.box.x1);
});

test('other body type gets the mean box and no silhouette', () => {
  const t = templateFor('other', 'left', 'normal')!;
  expect(t.path).toBeNull();
  const own = TEMPLATES.filter((g) => g.slot === 'left' && g.mode === 'normal');
  expect(own.map((g) => g.bodyType).sort()).toEqual(['hatchback', 'kombi', 'sedan', 'suv']);
  expect(t.box.x0).toBeCloseTo(own.reduce((s, g) => s + g.box[0], 0) / own.length, 4);
});

test('wide mode is only offered for side and 45 degree angles', () => {
  expect(templateFor('sedan', 'front', 'wide')).toBeNull();
  expect(templateFor('sedan', 'right', 'wide')).not.toBeNull();
  expect(EXTERIOR_SLOTS.filter(wideAllowed)).toEqual(['front_left_45', 'front_right_45', 'right', 'rear_right_45', 'rear_left_45', 'left']);
});
