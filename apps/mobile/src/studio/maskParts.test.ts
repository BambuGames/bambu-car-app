import { cutWidth, judgeRemove, labelParts } from './maskParts';

const grid = (rows: string[]) => {
  const height = rows.length;
  const width = rows[0].length;
  const alpha = new Uint8Array(width * height);
  rows.forEach((r, y) => [...r].forEach((c, x) => (alpha[y * width + x] = c === '#' ? 255 : 0)));
  return { alpha, width, height };
};
const at = (x: number, y: number, w: number, h: number) => ({ x: (x + 0.5) / w, y: (y + 0.5) / h });

test('judgeRemove tells a separate piece from the car and the background', () => {
  const g = grid(['######..##', '######..##', '######....']);
  const parts = labelParts(g.alpha, g.width, g.height);
  expect(judgeRemove(parts, at(9, 0, 10, 3))).toBe('accept');
  expect(judgeRemove(parts, at(1, 1, 10, 3))).toBe('joined');
  expect(judgeRemove(parts, at(7, 2, 10, 3))).toBe('nothing');
});

test('pixels touching at a corner are one part, as in the worker', () => {
  const g = grid(['##..', '##..', '..#.']);
  const parts = labelParts(g.alpha, g.width, g.height);
  expect(judgeRemove(parts, at(2, 2, 4, 3))).toBe('joined');
});

test('judgeRemove accepts every tap when the mask is not loaded', () => {
  expect(judgeRemove(null, { x: 0.5, y: 0.5 })).toBe('accept');
});

test('an erase cut in the snapshot is never thinner than 3 px, so a fine cut at high zoom still separates', () => {
  expect(cutWidth(0.0017, 512)).toBe(3); // small brush at 6x: 1.7 px would stay joined after anti-aliasing
  expect(cutWidth(0.02, 512)).toBeCloseTo(20.48, 5);
});
