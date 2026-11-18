// The part of the photo an editor shows (design 7.3, 7.4; phone round 1: a 4:3 photo on a phone is too small to
// place plate corners or paint precisely). x, y: top-left of the view, 0–1 of the photo; the view is 1/scale
// wide and high. Frame points are 0–1 of the editor's frame.
import type { Point } from './geometry';

export type View = { x: number; y: number; scale: number };

export const MAX_SCALE = 6;

const within = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampView(v: View): View {
  const scale = within(v.scale, 1, MAX_SCALE);
  const max = 1 - 1 / scale;
  return { x: within(v.x, 0, max), y: within(v.y, 0, max), scale };
}

export const frameToPhoto = (v: View, p: Point): Point => ({ x: v.x + p.x / v.scale, y: v.y + p.y / v.scale });

export const photoToFrame = (v: View, p: Point): Point => ({ x: (p.x - v.x) * v.scale, y: (p.y - v.y) * v.scale });

/** Zooms by `factor` around `focal` (a frame point): the photo point under it stays there. */
export function zoomAt(v: View, focal: Point, factor: number): View {
  const p = frameToPhoto(v, focal);
  const scale = within(v.scale * factor, 1, MAX_SCALE);
  return clampView({ x: p.x - focal.x / scale, y: p.y - focal.y / scale, scale });
}

/** Moves the photo with the fingers by dx, dy (shares of the frame). */
export const panBy = (v: View, dx: number, dy: number): View =>
  clampView({ x: v.x - dx / v.scale, y: v.y - dy / v.scale, scale: v.scale });
