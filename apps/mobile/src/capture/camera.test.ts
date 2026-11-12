import { canUseWide, shouldDetect, zoomFor } from './camera';

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
