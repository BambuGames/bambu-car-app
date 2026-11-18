import { canUseWide, centerCrop43, hfovAfterCrop, shouldDetect, zoomFor } from './camera';

test('zoomFor picks the main lens on an iPhone dual-wide device', () => {
  const iphone = { minZoom: 1, zoomLensSwitchFactors: [2] };
  expect(zoomFor('normal', iphone)).toBe(2);
  expect(zoomFor('wide', iphone)).toBe(1);
  expect(canUseWide(iphone)).toBe(true);
});

test('an Android main camera alone offers no wide mode', () => {
  const android = { minZoom: 1, zoomLensSwitchFactors: [] };
  expect(zoomFor('normal', android)).toBe(1);
  expect(canUseWide(android)).toBe(false);
});

test('detection gate skips frames inside 100 ms and while inactive', () => {
  expect(shouldDetect(1000, 950, true)).toBe(false);
  expect(shouldDetect(1050, 950, true)).toBe(true);
  expect(shouldDetect(5000, 0, false)).toBe(false);
});

test('centerCrop43 keeps the middle 4:3 of a wide landscape photo only', () => {
  expect(centerCrop43(3840, 2160)).toEqual({ x: 480, y: 0, width: 2880, height: 2160 });
  expect(centerCrop43(4032, 3024)).toEqual({ x: 0, y: 0, width: 4032, height: 3024 });
  expect(centerCrop43(1080, 1920)).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
});

test('hfovAfterCrop narrows the angle to the kept share', () => {
  expect(hfovAfterCrop(69.4, 0.75)).toBeCloseTo(54.9, 1);
  expect(hfovAfterCrop(69.4, 1)).toBeCloseTo(69.4, 5);
});
