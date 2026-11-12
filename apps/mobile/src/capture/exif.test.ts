import { focal35FromJpeg, hfovFromFocal35, plausibleHfov } from './exif';

// A minimal JPEG: SOI, a JFIF APP0, an APP1 Exif segment whose IFD0 points to an Exif IFD holding
// FocalLengthIn35mmFilm (0xA405, SHORT), then EOI.
function jpegWithFocal(order: 'II' | 'MM', focal35: number): Uint8Array {
  const le = order === 'II';
  const tiff = new DataView(new ArrayBuffer(8 + 18 + 18));
  tiff.setUint8(0, order.charCodeAt(0));
  tiff.setUint8(1, order.charCodeAt(1));
  tiff.setUint16(2, 42, le);
  tiff.setUint32(4, 8, le); // IFD0
  tiff.setUint16(8, 1, le); // one entry
  tiff.setUint16(10, 0x8769, le); // ExifIFDPointer
  tiff.setUint16(12, 4, le); // LONG
  tiff.setUint32(14, 1, le);
  tiff.setUint32(18, 26, le); // Exif IFD offset
  tiff.setUint32(22, 0, le); // no next IFD
  tiff.setUint16(26, 1, le);
  tiff.setUint16(28, 0xa405, le);
  tiff.setUint16(30, 3, le); // SHORT
  tiff.setUint32(32, 1, le);
  tiff.setUint16(36, focal35, le);
  tiff.setUint32(40, 0, le);
  const exif = [...Array.from('Exif').map((c) => c.charCodeAt(0)), 0, 0, ...new Uint8Array(tiff.buffer)];
  const app1Len = exif.length + 2;
  const jfif = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  return new Uint8Array([0xff, 0xd8, ...jfif, 0xff, 0xe1, app1Len >> 8, app1Len & 0xff, ...exif, 0xff, 0xd9]);
}

test('reads the 35 mm focal length from Intel and Motorola EXIF', () => {
  expect(focal35FromJpeg(jpegWithFocal('II', 26))).toBe(26);
  expect(focal35FromJpeg(jpegWithFocal('MM', 13))).toBe(13);
});

test('returns null without EXIF', () => {
  expect(focal35FromJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  expect(focal35FromJpeg(new Uint8Array([1, 2, 3]))).toBeNull();
});

test('hfovFromFocal35 matches the main and ultra wide template angles', () => {
  expect(hfovFromFocal35(26)).toBeCloseTo(67.3, 1);
  expect(hfovFromFocal35(13)).toBeCloseTo(106.2, 1);
});

test('plausibleHfov keeps only focal lengths a phone lens can have for the mode', () => {
  expect(plausibleHfov(26, 'normal')).toBeCloseTo(hfovFromFocal35(26));
  expect(plausibleHfov(13, 'wide')).toBeCloseTo(hfovFromFocal35(13));
  expect(plausibleHfov(14279, 'normal')).toBeNull(); // the emulator's EXIF
  expect(plausibleHfov(13, 'normal')).toBeNull();
  expect(plausibleHfov(26, 'wide')).toBeNull();
  expect(plausibleHfov(null, 'normal')).toBeNull();
});
