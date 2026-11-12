// The camera's field of view comes from the photo's EXIF 35 mm equivalent focal length, so the silhouette
// can be scaled to each phone (design 6.3).

import type { CaptureMode } from '../domain/templates';

const EXIF_IFD_POINTER = 0x8769;
const FOCAL_35MM = 0xa405;

// FocalLengthIn35mmFilm from a JPEG's APP1 Exif segment, or null when missing or 0 (unknown).
export function focal35FromJpeg(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 2;
  while (off + 4 <= bytes.length && bytes[off] === 0xff) {
    const marker = bytes[off + 1];
    if (marker === 0xd9 || marker === 0xda) break; // end of image, start of scan data
    const len = view.getUint16(off + 2);
    const isExif = marker === 0xe1 && String.fromCharCode(...bytes.subarray(off + 4, off + 8)) === 'Exif';
    if (isExif) return readFocal(view, off + 10, off + 2 + len);
    off += 2 + len;
  }
  return null;
}

function readFocal(view: DataView, tiff: number, end: number): number | null {
  if (tiff + 8 > end) return null;
  const le = view.getUint8(tiff) === 0x49; // 'II' Intel, else 'MM' Motorola
  const u16 = (at: number) => view.getUint16(at, le);
  const u32 = (at: number) => view.getUint32(at, le);
  // Value of a tag in the IFD at offset ifd (from the TIFF header), read as SHORT or LONG.
  const find = (ifd: number, tag: number): number | null => {
    const at = tiff + ifd;
    if (at + 2 > end) return null;
    for (let i = 0, count = u16(at); i < count; i++) {
      const entry = at + 2 + i * 12;
      if (entry + 12 > end) return null;
      if (u16(entry) === tag) return u16(entry + 2) === 3 ? u16(entry + 8) : u32(entry + 8);
    }
    return null;
  };
  const exifIfd = find(u32(tiff + 4), EXIF_IFD_POINTER);
  if (exifIfd === null) return null;
  const focal = find(exifIfd, FOCAL_35MM);
  return focal ? focal : null;
}

// Horizontal field of view of a 4:3 photo: 34.6 mm is the width of a 4:3 frame whose diagonal matches
// the 43.27 mm diagonal of 35 mm film, which the equivalent focal length refers to.
export const hfovFromFocal35 = (f35: number): number => (2 * Math.atan(34.6 / (2 * f35)) * 180) / Math.PI;

// 35 mm-equivalent focal lengths a phone's main (normal) and ultra-wide (wide) lens can have. One bad EXIF
// value (the emulator reports 14279 mm) would otherwise be stored and break the silhouette for good.
const FOCAL_RANGE: Record<CaptureMode, [number, number]> = { normal: [18, 40], wide: [10, 18] };

export function plausibleHfov(f35: number | null, mode: CaptureMode): number | null {
  const [lo, hi] = FOCAL_RANGE[mode];
  return f35 !== null && f35 >= lo && f35 <= hi ? hfovFromFocal35(f35) : null;
}
