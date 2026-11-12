import { iou, intersects, pickTarget, scaleBox, silhouetteScale, uprightToBuffer, type Detection } from './geometry';

const car = (box: Detection['box'], score = 0.9): Detection => ({ cls: 'car', score, box });

test('scaleBox shrinks around the frame center', () => {
  const b = scaleBox({ x0: 0.2, y0: 0.4, x1: 0.8, y1: 0.8 }, 0.5);
  expect(b.x0).toBeCloseTo(0.35);
  expect(b.y0).toBeCloseTo(0.45);
  expect(b.x1).toBeCloseTo(0.65);
  expect(b.y1).toBeCloseTo(0.65);
});

test('silhouetteScale is 1 for the template field of view and smaller for a wider lens', () => {
  expect(silhouetteScale(69, 69)).toBeCloseTo(1);
  expect(silhouetteScale(69, 80)).toBeLessThan(1);
});

test('iou and intersects measure overlap', () => {
  const a = { x0: 0, y0: 0, x1: 0.5, y1: 0.5 };
  expect(iou(a, a)).toBeCloseTo(1);
  expect(iou(a, { x0: 0.25, y0: 0, x1: 0.75, y1: 0.5 })).toBeCloseTo(1 / 3);
  expect(intersects(a, { x0: 0.5, y0: 0, x1: 1, y1: 0.5 })).toBe(false); // touching edges only
  expect(intersects(a, { x0: 0.4, y0: 0.4, x1: 1, y1: 1 })).toBe(true);
});

test('pickTarget prefers the vehicle overlapping the template box', () => {
  const expected = { x0: 0.3, y0: 0.4, x1: 0.7, y1: 0.8 };
  const big = car({ x0: 0, y0: 0.2, x1: 0.25, y1: 0.9 });
  const onTemplate = car({ x0: 0.32, y0: 0.42, x1: 0.68, y1: 0.78 });
  expect(pickTarget([big, onTemplate], expected)).toBe(onTemplate);
});

test('pickTarget falls back to the largest vehicle when none overlaps', () => {
  const expected = { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 };
  const small = car({ x0: 0, y0: 0, x1: 0.1, y1: 0.1 });
  const large = car({ x0: 0.7, y0: 0.7, x1: 1, y1: 1 });
  expect(pickTarget([small, large], expected)).toBe(large);
});

test('pickTarget ignores persons and low scores', () => {
  const expected = { x0: 0.3, y0: 0.4, x1: 0.7, y1: 0.8 };
  const person: Detection = { cls: 'person', score: 0.9, box: expected };
  expect(pickTarget([person, car(expected, 0.4)], expected)).toBeNull();
});

test('uprightToBuffer maps a point on the upright model input back to the raw frame', () => {
  // Inverse of VisionCamera's frame-to-camera counter-rotation (FrameCoordinateSystemConverter).
  expect(uprightToBuffer(0.2, 0.3, 'up')).toEqual({ x: 0.2, y: 0.3 });
  expect(uprightToBuffer(0.2, 0.3, 'down')).toEqual({ x: 0.8, y: 0.7 });
  expect(uprightToBuffer(0.2, 0.3, 'left')).toEqual({ x: 0.3, y: 0.8 });
  expect(uprightToBuffer(0.2, 0.3, 'right')).toEqual({ x: 0.7, y: 0.2 });
});
