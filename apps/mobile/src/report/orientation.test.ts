import { orientationMatrix, orientationToApply } from './orientation';

const apply = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

test('every orientation keeps the corners inside the output and 5-8 swap the size', () => {
  for (const o of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const { m, outW, outH } = orientationMatrix(o, 200, 100);
    expect([outW, outH]).toEqual(o >= 5 ? [100, 200] : [200, 100]);
    for (const [x, y] of [[0, 0], [200, 0], [0, 100], [200, 100]]) {
      const [dx, dy] = apply(m, x, y);
      expect(dx).toBeGreaterThanOrEqual(0);
      expect(dx).toBeLessThanOrEqual(outW);
      expect(dy).toBeGreaterThanOrEqual(0);
      expect(dy).toBeLessThanOrEqual(outH);
    }
  }
});

test('orientation 6 turns the image a quarter clockwise (top-left goes to top-right)', () => {
  const { m } = orientationMatrix(6, 200, 100);
  expect(apply(m, 0, 0)).toEqual([100, 0]);
  expect(apply(m, 200, 0)).toEqual([100, 200]);
});

test('a quarter turn is skipped when the picker already delivered upright pixels', () => {
  expect(orientationToApply(6, { w: 4000, h: 3000 }, { width: 3000, height: 4000 }, true)).toBe(6);
  expect(orientationToApply(6, { w: 3000, h: 4000 }, { width: 3000, height: 4000 }, false)).toBe(1);
});

test('half turns and mirrors are applied on Android only', () => {
  expect(orientationToApply(3, { w: 4000, h: 3000 }, { width: 4000, height: 3000 }, true)).toBe(3);
  expect(orientationToApply(3, { w: 4000, h: 3000 }, { width: 4000, height: 3000 }, false)).toBe(1);
  expect(orientationToApply(undefined, { w: 1, h: 2 }, { width: 1, height: 2 }, true)).toBe(1);
});

test('the tag may be a numeric string; anything else counts as 1', () => {
  const size = { w: 4000, h: 3000 };
  const asset = { width: 3000, height: 4000 };
  expect(orientationToApply('6', size, asset, true)).toBe(6);
  expect(orientationToApply('3', size, { width: 4000, height: 3000 }, true)).toBe(3);
  for (const tag of ['', 'x', '9', '0', 6.5, null, {}, [6]]) expect(orientationToApply(tag, size, asset, true)).toBe(1);
});
