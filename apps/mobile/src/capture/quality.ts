// Photo quality check right after capture (design 6.4), on the photo scaled down to 640×480 and 320×240.
import type { QcIssue } from '../domain/capture';
import type { Box } from '../domain/templates';

// Starting values, tuned on the test phones (plan Task 6). minSharpness: on the 48 M0 photos sharp ones
// stayed at 0.35 or above and heavily blurred copies at 0.29 or below (scripts/qc-calibrate.mjs).
export const QC_LIMITS = {
  minSharpness: 0.35,
  minMeanLuma: 40,
  maxClippedShare: 0.15,
  edgeMargin: 0.01,
  aspectTolerance: 0.02,
  // Beyond these the photo cannot be saved by processing: the worker levels a roll up to 20° (MAX_ROLL_DEG),
  // and a steeper view down distorts the car (phone round 1: 33°).
  maxRollDeg: 20,
  maxPitchDeg: 20,
};

export type QualityMetrics = { meanLuma: number; clippedShare: number; laplacianVar: number };
// sharpness: Laplacian variance at 640×480 over that at 320×240. Fine detail keeps it up; blur removes the
// fine detail first, so it drops whatever the scene. The absolute variance mostly measures the scene.
export type PhotoMetrics = QualityMetrics & { sharpness: number };

export function analyzeRgba(px: Uint8Array, width: number, height: number): QualityMetrics {
  const gray = new Float32Array(width * height);
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    gray[i] = l;
    sum += l;
    if (l >= 250) clipped++;
  }
  // Variance of the 4-neighbour Laplacian over the inner pixels: low when the photo has no sharp edges.
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  return { meanLuma: sum / gray.length, clippedShare: clipped / gray.length, laplacianVar: n > 1 ? m2 / n : 0 };
}

// Exposure from the small view, sharpness from both.
export const photoMetrics = (large: QualityMetrics, small: QualityMetrics): PhotoMetrics => ({
  ...small,
  sharpness: small.laplacianVar > 0 ? large.laplacianVar / small.laplacianVar : 0,
});

export function qcIssues(
  m: PhotoMetrics,
  f: { width: number; height: number; target: Box | null; exterior: boolean; tilt: { rollDeg: number; pitchDeg: number } | null },
): QcIssue[] {
  const issues: QcIssue[] = [];
  if (m.sharpness < QC_LIMITS.minSharpness) issues.push('blurry');
  if (m.meanLuma < QC_LIMITS.minMeanLuma) issues.push('dark');
  if (m.clippedShare > QC_LIMITS.maxClippedShare) issues.push('overexposed');
  const t = f.target;
  const e = QC_LIMITS.edgeMargin;
  if (f.exterior && t && (t.x0 < e || t.y0 < e || t.x1 > 1 - e || t.y1 > 1 - e)) issues.push('cutOff');
  if (Math.abs(f.width / f.height - 4 / 3) > QC_LIMITS.aspectTolerance) issues.push('aspect');
  const tilt = f.tilt;
  if (f.exterior && tilt && (tilt.rollDeg > QC_LIMITS.maxRollDeg || tilt.pitchDeg > QC_LIMITS.maxPitchDeg)) issues.push('tilted');
  return issues;
}

// Channel positions (R, G, B) and bytes per pixel of the raw layouts nitro-image can return.
const LAYOUTS: Record<string, { r: number; g: number; b: number; size: number }> = {
  RGBA: { r: 0, g: 1, b: 2, size: 4 },
  RGBX: { r: 0, g: 1, b: 2, size: 4 },
  BGRA: { r: 2, g: 1, b: 0, size: 4 },
  BGRX: { r: 2, g: 1, b: 0, size: 4 },
  ARGB: { r: 1, g: 2, b: 3, size: 4 },
  XRGB: { r: 1, g: 2, b: 3, size: 4 },
  ABGR: { r: 3, g: 2, b: 1, size: 4 },
  XBGR: { r: 3, g: 2, b: 1, size: 4 },
  RGB: { r: 0, g: 1, b: 2, size: 3 },
  BGR: { r: 2, g: 1, b: 0, size: 3 },
};

export function toRgba(buffer: ArrayBuffer, format: string, width: number, height: number): Uint8Array {
  const layout = LAYOUTS[format];
  if (!layout) throw new Error(`unsupported pixel format ${format}`);
  const src = new Uint8Array(buffer);
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const at = i * layout.size;
    out[i * 4] = src[at + layout.r];
    out[i * 4 + 1] = src[at + layout.g];
    out[i * 4 + 2] = src[at + layout.b];
    out[i * 4 + 3] = 255;
  }
  return out;
}
