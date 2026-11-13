import { brandingCrop } from './branding';

test('a banner is cut from the middle to the plate shape, 520:110', () => {
  expect(brandingCrop('banner', 1000, 1000)).toEqual({ src: { x: 0, y: 394, w: 1000, h: 212 }, out: { w: 1000, h: 212 } });
  expect(brandingCrop('banner', 4000, 500)).toEqual({ src: { x: 818, y: 0, w: 2364, h: 500 }, out: { w: 1040, h: 220 } });
});

test('a logo keeps its shape and is scaled down to 1200 px at most', () => {
  expect(brandingCrop('logo', 2400, 1200)).toEqual({ src: { x: 0, y: 0, w: 2400, h: 1200 }, out: { w: 1200, h: 600 } });
  expect(brandingCrop('logo', 300, 100)).toEqual({ src: { x: 0, y: 0, w: 300, h: 100 }, out: { w: 300, h: 100 } });
});
