import { showroomSwatch } from './swatch';

const SPEC = { kind: 'showroom', wall: '#F0F1F1', ceiling: '#F6F7F7', floor: '#44474B', grout: '#2B2D30', gloss: 0.55 } as const;

const area = (p: [number, number][]) =>
  Math.abs(
    p.reduce((s, [x, y], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      return s + x * y2 - x2 * y;
    }, 0),
  ) / 2;

test('the showroom swatch fills the frame with ceiling, two walls and the floor', () => {
  const { polygons, lines } = showroomSwatch(SPEC, 96, 72);
  expect(polygons.map((p) => area(p.points)).reduce((a, b) => a + b, 0)).toBeCloseTo(96 * 72, 0);
  expect(polygons.some((p) => p.fill === SPEC.floor)).toBe(true);
  expect(lines.length).toBeGreaterThanOrEqual(3);
  expect(lines.every((l) => l.color === SPEC.grout)).toBe(true);
  expect(polygons.flatMap((p) => p.points).every(([x, y]) => x >= 0 && x <= 96 && y >= 0 && y <= 72)).toBe(true);
});
