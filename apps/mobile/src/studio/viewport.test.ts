import { frameToPhoto, MAX_SCALE, panBy, photoToFrame, zoomAt } from './viewport';

test('zoomAt keeps the photo point under the fingers in place', () => {
  const v = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0.25, y: 0.5 }, 2);
  expect(frameToPhoto(v, { x: 0.25, y: 0.5 })).toEqual({ x: 0.25, y: 0.5 });
  expect(v.scale).toBe(2);
});

test('the view never shows past the photo or below 1x', () => {
  expect(zoomAt({ x: 0.3, y: 0.3, scale: 2 }, { x: 0.5, y: 0.5 }, 0.1)).toEqual({ x: 0, y: 0, scale: 1 });
  expect(panBy({ x: 0.4, y: 0, scale: 2 }, -0.5, 0)).toEqual({ x: 0.5, y: 0, scale: 2 });
  expect(zoomAt({ x: 0, y: 0, scale: 5 }, { x: 0, y: 0 }, 3).scale).toBe(MAX_SCALE);
});

test('frameToPhoto and photoToFrame undo each other', () => {
  const v = { x: 0.2, y: 0.1, scale: 3 };
  const p = { x: 0.3, y: 0.25 };
  const back = frameToPhoto(v, photoToFrame(v, p));
  expect(back.x).toBeCloseTo(p.x, 10);
  expect(back.y).toBeCloseTo(p.y, 10);
});
