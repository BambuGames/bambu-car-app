import type { Placement } from './geometry';
import { simplify, toOriginalStroke, toOriginalTap, toOutputRadius, undo } from './edits';

// A 1000×750 original drawn twice as large, 80 px from the left and 60 px from the top of the output.
const placement: Placement = { m: [[2, 0, 80], [0, 2, 60]], src: [1000, 750] };

test('a tap becomes a remove edit at the right spot of the original', () => {
  const edit = toOriginalTap(placement, { x: 0.5, y: 0.5 });
  expect(edit.type).toBe('remove');
  if (edit.type !== 'remove') return;
  expect(edit.point[0]).toBeCloseTo(0.6); // (1280 − 80) / 2 / 1000
  expect(edit.point[1]).toBeCloseTo(0.6); // (960 − 60) / 2 / 750
});

test('a stroke keeps its width relative to the original', () => {
  // A 1 % brush is 25.6 output px, 12.8 px of the original, 1.28 % of its width.
  const edit = toOriginalStroke(placement, [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }], 0.01);
  expect(edit.type).toBe('erase');
  if (edit.type !== 'erase') return;
  expect(edit.radius).toBeCloseTo(0.0128);
  expect(edit.points[0][0]).toBeCloseTo(0.6);
  expect(edit.points[1][0]).toBeCloseTo((0.6 * 2560 - 80) / 2 / 1000);
  expect(toOutputRadius(placement, edit.radius)).toBeCloseTo(0.01); // drawn back at the size it was painted
});

test('simplify drops points closer than the minimum step', () => {
  const points = [{ x: 0.1, y: 0.1 }, { x: 0.101, y: 0.1 }, { x: 0.102, y: 0.1 }, { x: 0.105, y: 0.1 }, { x: 0.2, y: 0.2 }];
  expect(simplify(points)).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.105, y: 0.1 }, { x: 0.2, y: 0.2 }]);
});

test('undo removes only the last edit', () => {
  const a = { type: 'remove' as const, point: [0.1, 0.1] as [number, number] };
  const b = { type: 'remove' as const, point: [0.2, 0.2] as [number, number] };
  expect(undo([a, b])).toEqual([a]);
  expect(undo([])).toEqual([]);
});
