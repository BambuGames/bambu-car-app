import type { Slot } from './slots';
import type { CaptureMode } from './templates';

// Stored with the photo (photos.capture): how it was taken, for straightening and masking later.
export type CaptureInfo = {
  template: string | null; // e.g. 'sedan/front_left_45/normal'
  mode: CaptureMode;
  hfovDeg: number;
  focal35: number | null;
  rollDeg: number;
  pitchDeg: number;
  targetBox: [number, number, number, number] | null;
  simpleMode: boolean;
  auto: boolean;
  platform: 'ios' | 'android';
  deviceModel: string | null;
  width: number;
  height: number;
};

export type QcIssue = 'blurry' | 'dark' | 'overexposed' | 'cutOff' | 'aspect';

// Stored with the photo (photos.qc): what the check found and whether the user kept it anyway.
export type QcResult = {
  issues: QcIssue[];
  accepted: boolean;
  sharpness: number;
  laplacianVar: number;
  meanLuma: number;
  clippedShare: number;
};

// One file per capture, so a re-shot never overwrites a file that may still be uploading.
export const photoFileName = (vehicleId: string, slot: Slot, capturedAt: string): string =>
  `${vehicleId}/${slot}-${capturedAt.replace(/[:.]/g, '-')}.jpg`;
