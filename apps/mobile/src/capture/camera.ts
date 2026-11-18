import type { CaptureMode } from '../domain/templates';

type ZoomDevice = { minZoom: number; zoomLensSwitchFactors: number[] };

// VisionCamera zoom values are the device's own factors. On an iPhone ultra-wide + wide device 1 is the
// ultra-wide and the main lens starts at the first switch factor; Android reports 1 for the main lens (M0).
export const zoomFor = (mode: CaptureMode, d: ZoomDevice): number =>
  mode === 'wide' ? d.minZoom : (d.zoomLensSwitchFactors[0] ?? 1);

export const canUseWide = (d: ZoomDevice): boolean => d.minZoom < zoomFor('normal', d);

// At most one detection per intervalMs, none while the camera screen is not in use (heat, M0 iPhone 11).
export function shouldDetect(now: number, lastRun: number, active: boolean, intervalMs = 100): boolean {
  'worklet';
  return active && now - lastRun >= intervalMs;
}

// Some phones (Galaxy A34) deliver 16:9 although 4:3 is asked for; the preview shows the middle 4:3 of it, so that
// is what the photo keeps. Anything else (4:3, or a portrait frame the quality check flags) stays whole.
export function centerCrop43(width: number, height: number): { x: number; y: number; width: number; height: number } {
  if (width / height <= 4 / 3 + 0.02) return { x: 0, y: 0, width, height };
  const kept = Math.round((height * 4) / 3);
  return { x: Math.floor((width - kept) / 2), y: 0, width: kept, height };
}

// The horizontal field of view left after keeping the middle `share` of the width.
export const hfovAfterCrop = (hfovDeg: number, share: number): number =>
  (2 * Math.atan(Math.tan((hfovDeg * Math.PI) / 360) * share) * 180) / Math.PI;
