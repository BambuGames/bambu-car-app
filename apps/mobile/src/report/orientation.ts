// EXIF orientation (1-8) as the matrix [a, b, c, d, e, f] that maps a source pixel (x, y) of a w x h image to
// (a x + c y + e, a' ...): dest.x = a*x + c*y + e, dest.y = b*x + d*y + f. 5-8 turn the image by a quarter.
export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function orientationMatrix(o: Orientation, w: number, h: number): { m: [number, number, number, number, number, number]; outW: number; outH: number } {
  switch (o) {
    case 2: return { m: [-1, 0, 0, 1, w, 0], outW: w, outH: h };
    case 3: return { m: [-1, 0, 0, -1, w, h], outW: w, outH: h };
    case 4: return { m: [1, 0, 0, -1, 0, h], outW: w, outH: h };
    case 5: return { m: [0, 1, 1, 0, 0, 0], outW: h, outH: w };
    case 6: return { m: [0, 1, -1, 0, h, 0], outW: h, outH: w };
    case 7: return { m: [0, -1, -1, 0, h, w], outW: h, outH: w };
    case 8: return { m: [0, -1, 1, 0, 0, w], outW: h, outH: w };
    default: return { m: [1, 0, 0, 1, 0, 0], outW: w, outH: h };
  }
}

// The orientation to apply to the decoded pixels, or 1. Skia decodes the raw pixels and ignores the tag. A picker may
// already have turned the pixels upright and reported the upright size (width/height of the asset): when the decoded
// size already equals that, a quarter turn would turn it twice. Half turns and mirrors cannot be told apart by size,
// so they are applied only where the picker hands over the original file (Android).
export function orientationToApply(tag: unknown, decoded: { w: number; h: number }, asset: { width: number; height: number }, android: boolean): Orientation {
  const n = typeof tag === 'string' && /^[1-8]$/.test(tag) ? Number(tag) : tag; // some pickers hand the tag over as text
  const o = typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 8 ? (n as Orientation) : 1;
  if (o >= 5) return decoded.w === asset.width && decoded.h === asset.height && asset.width !== asset.height ? 1 : o;
  return android ? o : 1;
}
