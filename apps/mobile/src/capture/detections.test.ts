import { parseDetections } from './detections';

test('parseDetections keeps cars, trucks and persons above the score', () => {
  // boxes are [ymin, xmin, ymax, xmax]; index 5 lies beyond count and is ignored
  const boxes = new Float32Array([
    0.1, 0.2, 0.5, 0.6, // car 0.9
    0.2, 0.0, 0.6, 0.3, // truck 0.6
    0.3, 0.7, 0.9, 0.8, // person 0.7
    0.0, 0.0, 0.2, 0.2, // bicycle 0.9
    0.4, 0.4, 0.6, 0.6, // car 0.4
    0.5, 0.5, 0.9, 0.9, // car 0.95, beyond count
  ]);
  const classes = new Float32Array([2, 7, 0, 1, 2, 2]);
  const scores = new Float32Array([0.9, 0.6, 0.7, 0.9, 0.4, 0.95]);
  const dets = parseDetections(boxes, classes, scores, 5);
  expect(dets.map((d) => [d.cls, d.score])).toEqual([
    ['car', expect.closeTo(0.9)],
    ['truck', expect.closeTo(0.6)],
    ['person', expect.closeTo(0.7)],
  ]);
  expect(dets[0].box.x0).toBeCloseTo(0.2);
  expect(dets[0].box.y0).toBeCloseTo(0.1);
  expect(dets[0].box.x1).toBeCloseTo(0.6);
  expect(dets[0].box.y1).toBeCloseTo(0.5);
});
