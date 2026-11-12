import type { Detection } from './geometry';
import {
  createAutoCapture,
  createRateMonitor,
  createSpaceAdvisor,
  evaluateGuidance,
  horizonDeg,
  tiltFromGravity,
} from './guidance';

const rad = (deg: number) => (deg * Math.PI) / 180;
const EXPECTED = { x0: 0.2, y0: 0.4, x1: 0.8, y1: 0.8 };
const car = (box: Detection['box']): Detection => ({ cls: 'car', score: 0.9, box });
const shift = (dx: number, dy: number, s = 1): Detection['box'] => {
  const cx = 0.5 + dx;
  const cy = 0.6 + dy;
  return { x0: cx - 0.3 * s, y0: cy - 0.2 * s, x1: cx + 0.3 * s, y1: cy + 0.2 * s };
};
const input = (over: Partial<Parameters<typeof evaluateGuidance>[0]> = {}): Parameters<typeof evaluateGuidance>[0] => ({
  tilt: { rollDeg: 0, pitchDeg: 0 },
  rotationRateDegPerSec: 0,
  expected: EXPECTED,
  target: car(shift(0, 0)),
  others: [],
  detectionAgeMs: 0,
  simple: false,
  lumaOnTarget: 120,
  ...over,
});

test('tiltFromGravity reads level and tilted landscape holds', () => {
  expect(tiltFromGravity({ x: -9.81, y: 0, z: 0 })).toEqual({ rollDeg: 0, pitchDeg: 0 });
  expect(tiltFromGravity({ x: 9.81 * Math.cos(rad(5)), y: 9.81 * Math.sin(rad(5)), z: 0 }).rollDeg).toBeCloseTo(5);
  expect(tiltFromGravity({ x: -9.81 * Math.cos(rad(10)), y: 0, z: 9.81 * Math.sin(rad(10)) }).pitchDeg).toBeCloseTo(10);
});

test('a car on the template with a level, still phone is ready', () => {
  expect(evaluateGuidance(input())).toEqual({ ready: true, message: null, warnings: [], blockAuto: false });
});

test('messages follow the priority order', () => {
  const far = car(shift(0, 0, 0.8));
  expect(evaluateGuidance(input({ tilt: { rollDeg: 3, pitchDeg: 0 }, target: far })).message).toBe('holdLevel');
  expect(evaluateGuidance(input({ tilt: { rollDeg: 0, pitchDeg: 5 } })).message).toBe('holdLevel');
  expect(evaluateGuidance(input({ target: far })).message).toBe('moveCloser');
  expect(evaluateGuidance(input({ target: car(shift(0, 0, 1.2)) })).message).toBe('moveBack');
  expect(evaluateGuidance(input({ target: car(shift(0.1, 0)) })).message).toBe('panRight');
  expect(evaluateGuidance(input({ target: car(shift(-0.1, 0)) })).message).toBe('panLeft');
  expect(evaluateGuidance(input({ target: car(shift(0, 0.1)) })).message).toBe('lower');
  expect(evaluateGuidance(input({ target: car(shift(0, -0.1)) })).message).toBe('raise');
});

test('a moving phone is not ready but shows no message', () => {
  expect(evaluateGuidance(input({ rotationRateDegPerSec: 20 }))).toMatchObject({ ready: false, message: null });
});

test('a person touching the car blocks auto capture', () => {
  const person: Detection = { cls: 'person', score: 0.8, box: { x0: 0.75, y0: 0.3, x1: 0.9, y1: 0.9 } };
  expect(evaluateGuidance(input({ others: [person] }))).toMatchObject({ message: 'personInFrame', blockAuto: true, ready: false });
});

test('another vehicle touching the car only warns', () => {
  const other = car({ x0: 0.75, y0: 0.45, x1: 1, y1: 0.85 });
  expect(evaluateGuidance(input({ others: [other] }))).toEqual({ ready: true, message: null, warnings: ['otherVehicle'], blockAuto: false });
});

test('low light on the car only warns', () => {
  expect(evaluateGuidance(input({ lumaOnTarget: 30 }))).toMatchObject({ ready: true, warnings: ['lowLight'] });
});

test('stale detections count as no car', () => {
  expect(evaluateGuidance(input({ detectionAgeMs: 500 })).message).toBe('noCar');
  expect(evaluateGuidance(input({ target: null })).message).toBe('noCar');
});

test('simple mode checks only level and stability', () => {
  expect(evaluateGuidance(input({ simple: true, target: null }))).toMatchObject({ ready: true, message: null });
  expect(evaluateGuidance(input({ expected: null, target: null }))).toMatchObject({ ready: true, message: null });
  expect(evaluateGuidance(input({ simple: true, target: null, tilt: { rollDeg: 4, pitchDeg: 0 } })).message).toBe('holdLevel');
});

test('auto capture fires once after 500 ms of readiness', () => {
  const auto = createAutoCapture();
  expect(auto.update(true, false, 0)).toBe(false);
  expect(auto.update(true, false, 499)).toBe(false);
  expect(auto.update(true, false, 500)).toBe(true);
  expect(auto.update(true, false, 900)).toBe(false);
  auto.reset();
  expect(auto.update(true, false, 1000)).toBe(false);
  expect(auto.update(false, false, 1200)).toBe(false);
  expect(auto.update(true, false, 1300)).toBe(false);
  expect(auto.update(true, false, 1700)).toBe(false); // hold restarted at 1300
  expect(auto.update(true, false, 1800)).toBe(true);
  const blocked = createAutoCapture();
  expect([0, 300, 600, 900].map((t) => blocked.update(true, true, t))).toEqual([false, false, false, false]);
});

test('rate monitor switches to simple mode after 3 s under 4 detections per second', () => {
  const slow = createRateMonitor();
  for (let t = 0; t <= 4000; t += 334) slow.tick(t); // 3 per second
  expect(slow.isSimple(4000)).toBe(true);
  for (let t = 4000; t <= 8000; t += 100) slow.tick(t);
  expect(slow.isSimple(8000)).toBe(true); // latched

  const fast = createRateMonitor();
  for (let t = 0; t <= 4000; t += 200) fast.tick(t); // 5 per second
  expect(fast.isSimple(4000)).toBe(false);
  expect(createRateMonitor().isSimple(10000)).toBe(false); // nothing measured yet
});

test('rate monitor switches to simple mode when detection runs keep failing', () => {
  const broken = createRateMonitor();
  broken.attempt(1000); // a run that failed: measured time, no detection
  expect(broken.isSimple(3500)).toBe(false);
  expect(broken.isSimple(4000)).toBe(true);
});

test('space advisor suggests wide mode, then asks for more space', () => {
  const withWide = createSpaceAdvisor(true);
  expect(withWide.update(1.3, 'normal', 0)).toBeNull();
  expect(withWide.update(1.3, 'normal', 1999)).toBeNull();
  expect(withWide.update(1.3, 'normal', 2000)).toBe('suggestWide');
  expect(withWide.update(1.0, 'normal', 2100)).toBeNull();
  expect(withWide.update(1.3, 'wide', 3000)).toBeNull();
  expect(withWide.update(1.3, 'wide', 5000)).toBe('needsSpace');

  const noWide = createSpaceAdvisor(false);
  noWide.update(1.3, 'normal', 0);
  expect(noWide.update(1.3, 'normal', 2000)).toBe('needsSpace');
  expect(noWide.update(null, 'normal', 2100)).toBeNull();
});

test('rate monitor ignores time while detection is paused on purpose', () => {
  const m = createRateMonitor();
  for (let t = 0; t <= 1000; t += 100) m.tick(t); // detecting at 10 per second
  m.pause(); // a photo is being taken and saved
  expect(m.isSimple(6000)).toBe(false);
  for (let t = 6000; t <= 7000; t += 100) m.tick(t); // detecting again
  expect(m.isSimple(7000)).toBe(false);
});

test('a detail or interior shot gets no level message', () => {
  const g = evaluateGuidance(input({ expected: null, target: null, tilt: { rollDeg: 20, pitchDeg: 70 } }));
  expect(g.message).toBeNull();
});

test('horizonDeg is signed the same way on both landscape sides', () => {
  const g = (deg: number, side: 1 | -1) => ({ x: side * 9.81 * Math.cos(rad(deg)), y: side * 9.81 * Math.sin(rad(deg)) });
  expect(horizonDeg(g(5, 1))).toBeCloseTo(5);
  expect(horizonDeg(g(5, -1))).toBeCloseTo(5);
  expect(horizonDeg(g(-3, 1))).toBeCloseTo(-3);
  expect(horizonDeg(g(-3, -1))).toBeCloseTo(-3);
  expect(horizonDeg(g(0, 1))).toBeCloseTo(0);
});
