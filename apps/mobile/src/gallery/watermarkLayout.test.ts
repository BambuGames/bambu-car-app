// The same numbers as the worker's tests: the app's preview and the rendered photo must agree.
import { watermarkLayout, WATERMARK_DEFAULTS } from './watermarkLayout';

test('the logo sits where the worker puts it', () => {
  const { band, logo } = watermarkLayout({ ...WATERMARK_DEFAULTS, position: 'bottom_right', width: 0.18 }, 2, 400, 300);
  expect(band).toBeNull();
  expect(logo).toEqual({ x: 316, y: 252, w: 72, h: 36, opacity: 0.85 });
});

test('a band holds the logo inside it', () => {
  const { band, logo } = watermarkLayout({ ...WATERMARK_DEFAULTS, band: { edge: 'bottom', color: '#0B57D0', height: 0.1 } }, 2, 400, 300);
  expect(band).toEqual({ y: 270, h: 30, color: '#0B57D0' });
  expect(logo!.h).toBeLessThanOrEqual(21);
  expect(logo!.y).toBeGreaterThanOrEqual(270);
  expect(logo!.y + logo!.h).toBeLessThanOrEqual(300);
});

test('settings outside the limits are clamped', () => {
  const { logo } = watermarkLayout({ ...WATERMARK_DEFAULTS, width: 0.9, opacity: 2 }, 2, 400, 300);
  expect(logo!.w).toBe(160);
  expect(logo!.opacity).toBe(1);
});

test('without a logo only the band is drawn', () => {
  const { band, logo } = watermarkLayout({ ...WATERMARK_DEFAULTS, band: { edge: 'top', color: '#18181B' } }, null, 400, 300);
  expect(band).toEqual({ y: 0, h: 24, color: '#18181B' }); // default height 0.08
  expect(logo).toBeNull();
});
