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
