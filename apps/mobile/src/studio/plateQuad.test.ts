import { isConvexQuad, moveCorner, plateView } from './plateQuad';

const plate = [
  { x: 0.4, y: 0.6 },
  { x: 0.6, y: 0.6 },
  { x: 0.6, y: 0.65 },
  { x: 0.4, y: 0.65 },
];

test('moveCorner keeps the corner inside the photo', () => {
  expect(moveCorner(plate, 1, { x: 1.3, y: -0.2 })[1]).toEqual({ x: 1, y: 0 });
});

test('moveCorner refuses a self-crossing quad', () => {
  expect(moveCorner(plate, 0, { x: 0.7, y: 0.6 })).toBe(plate); // top-left dragged past top-right
});

test('isConvexQuad accepts a tilted plate and rejects a bow-tie', () => {
  expect(isConvexQuad([{ x: 0.42, y: 0.61 }, { x: 0.61, y: 0.58 }, { x: 0.62, y: 0.63 }, { x: 0.43, y: 0.66 }])).toBe(true);
  expect(isConvexQuad([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(false);
});

test('the editor zooms in so the plate spans about 60 % of the frame', () => {
  const view = plateView([{ x: 0.4, y: 0.6 }, { x: 0.6, y: 0.6 }, { x: 0.6, y: 0.65 }, { x: 0.4, y: 0.65 }]);
  expect(view.scale).toBeCloseTo(3);
  expect(view.x).toBeCloseTo(0.5 - 1 / 6); // centred on the plate
  expect(view.y).toBeCloseTo(0.625 - 1 / 6);
});

test('the zoomed view stays inside the photo and zooms at most 4×', () => {
  const view = plateView([{ x: 0.85, y: 0.93 }, { x: 0.98, y: 0.93 }, { x: 0.98, y: 0.97 }, { x: 0.85, y: 0.97 }]);
  expect(view).toEqual({ x: 0.75, y: 0.75, scale: 4 });
});

test('a plate wider than 60 % is shown whole', () => {
  expect(plateView([{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.9, y: 0.6 }, { x: 0.1, y: 0.6 }])).toEqual({ x: 0, y: 0, scale: 1 });
});
