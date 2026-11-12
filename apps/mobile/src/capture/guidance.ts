// Live guidance decisions for the capture screen (design 6.3). Pure functions; the screen feeds them
// sensor readings and detections about ten times a second.
import type { Box, CaptureMode } from '../domain/templates';
import { center, intersects, MIN_SCORE, width, type Detection } from './geometry';

// Starting values; tuned on the test phones (plan Task 6).
export const TOLERANCES = {
  rollDeg: 2,
  pitchDeg: 4,
  centerX: 0.04,
  centerY: 0.04,
  sizeRatio: 0.08,
  stableDegPerSec: 8,
  holdMs: 500,
  staleMs: 400,
  minLuma: 50,
  tooLargeRatio: 1.25,
  tooLargeMs: 2000,
};

export type GuidanceMessage =
  | 'personInFrame'
  | 'holdLevel'
  | 'noCar'
  | 'moveCloser'
  | 'moveBack'
  | 'panLeft'
  | 'panRight'
  | 'lower'
  | 'raise';
export type GuidanceWarning = 'otherVehicle' | 'lowLight';

// Landscape hold. Magnitudes only, so the sign conventions of each platform and landscape side do not matter.
export function tiltFromGravity(g: { x: number; y: number; z: number }): { rollDeg: number; pitchDeg: number } {
  const deg = 180 / Math.PI;
  return {
    rollDeg: Math.atan2(Math.abs(g.y), Math.abs(g.x)) * deg,
    pitchDeg: Math.atan2(Math.abs(g.z), Math.hypot(g.x, g.y)) * deg,
  };
}

function carMessage(target: Detection | null, expected: Box): GuidanceMessage | null {
  if (!target) return 'noCar';
  const ratio = width(target.box) / width(expected);
  if (ratio < 1 - TOLERANCES.sizeRatio) return 'moveCloser';
  if (ratio > 1 + TOLERANCES.sizeRatio) return 'moveBack';
  const t = center(target.box);
  const e = center(expected);
  if (t.x - e.x > TOLERANCES.centerX) return 'panRight';
  if (e.x - t.x > TOLERANCES.centerX) return 'panLeft';
  if (t.y - e.y > TOLERANCES.centerY) return 'lower'; // car sits low in the frame: the camera is too high
  if (e.y - t.y > TOLERANCES.centerY) return 'raise';
  return null;
}

export function evaluateGuidance(i: {
  tilt: { rollDeg: number; pitchDeg: number };
  rotationRateDegPerSec: number;
  expected: Box | null;
  target: Detection | null;
  others: Detection[];
  detectionAgeMs: number;
  simple: boolean;
  lumaOnTarget: number | null;
}): { ready: boolean; message: GuidanceMessage | null; warnings: GuidanceWarning[]; blockAuto: boolean } {
  const warnings: GuidanceWarning[] = [];
  const checksCar = !i.simple && i.expected !== null;
  const target = i.target && i.detectionAgeMs <= TOLERANCES.staleMs ? i.target : null;
  let message: GuidanceMessage | null = null;
  let blockAuto = false;

  if (checksCar && target) {
    const touching = i.others.filter((o) => o.score >= MIN_SCORE && intersects(o.box, target.box));
    if (touching.some((o) => o.cls === 'person')) {
      message = 'personInFrame';
      blockAuto = true;
    }
    if (touching.some((o) => o.cls !== 'person')) warnings.push('otherVehicle');
    if (i.lumaOnTarget !== null && i.lumaOnTarget < TOLERANCES.minLuma) warnings.push('lowLight');
  }
  const level = i.tilt.rollDeg <= TOLERANCES.rollDeg && i.tilt.pitchDeg <= TOLERANCES.pitchDeg;
  if (!message && !level) message = 'holdLevel';
  if (!message && checksCar) message = carMessage(target, i.expected!);

  const stable = i.rotationRateDegPerSec < TOLERANCES.stableDegPerSec;
  return { ready: message === null && stable, message, warnings, blockAuto };
}

// Fires once when the phone has been ready for holdMs without a break; reset() arms it for the next photo.
export function createAutoCapture(holdMs = TOLERANCES.holdMs) {
  let since: number | null = null;
  let fired = false;
  return {
    update(ready: boolean, blockAuto: boolean, now: number): boolean {
      if (!ready || blockAuto) {
        since = null;
        return false;
      }
      if (fired) return false;
      since ??= now;
      if (now - since < holdMs) return false;
      fired = true;
      return true;
    },
    reset() {
      since = null;
      fired = false;
    },
  };
}

// Simple mode (design 6.3, M0 threshold): under 4 detections a second for 3 s. Latched for the session.
export function createRateMonitor(minPerSec = 4, forMs = 3000) {
  let ticks: number[] = [];
  let started = false;
  let belowSince: number | null = null;
  let simple = false;
  const observe = (now: number) => {
    ticks = ticks.filter((t) => now - t < 1000);
    if (ticks.length >= minPerSec) {
      belowSince = null;
      return;
    }
    belowSince ??= now;
    if (now - belowSince >= forMs) simple = true;
  };
  return {
    tick(now: number) {
      started = true;
      ticks.push(now);
      observe(now);
    },
    // A detection run that failed (no GPU path for the resizer, say): the clock starts without a detection.
    attempt(now: number) {
      started = true;
      observe(now);
    },
    isSimple(now: number): boolean {
      if (!simple && started) observe(now);
      return simple;
    },
  };
}

// The car stays too large for the frame: offer the ultra-wide lens, or say this spot is too tight (design 6.3).
export function createSpaceAdvisor(wideAvailable: boolean) {
  let since: number | null = null;
  let lastMode: CaptureMode | null = null;
  return {
    update(sizeRatio: number | null, mode: CaptureMode, now: number): 'suggestWide' | 'needsSpace' | null {
      if (mode !== lastMode) since = null;
      lastMode = mode;
      if (sizeRatio === null || sizeRatio <= TOLERANCES.tooLargeRatio) {
        since = null;
        return null;
      }
      since ??= now;
      if (now - since < TOLERANCES.tooLargeMs) return null;
      return mode === 'normal' && wideAvailable ? 'suggestWide' : 'needsSpace';
    },
  };
}
