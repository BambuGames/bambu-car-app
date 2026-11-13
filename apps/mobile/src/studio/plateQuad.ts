// Dragging plate corners (design 7.4): a corner stays inside the photo and the quad never folds over itself.
import type { Point } from './geometry';

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export function isConvexQuad(quad: Point[]): boolean {
  const turns = quad.map((p, i) => cross(p, quad[(i + 1) % 4], quad[(i + 2) % 4]));
  return turns.every((t) => t > 0) || turns.every((t) => t < 0);
}

export function moveCorner(quad: Point[], index: number, to: Point): Point[] {
  const clamped = { x: Math.min(1, Math.max(0, to.x)), y: Math.min(1, Math.max(0, to.y)) };
  const next = quad.map((p, i) => (i === index ? clamped : p));
  return isConvexQuad(next) ? next : quad;
}

const PLATE_SHARE = 0.6; // of the frame's width
const MAX_ZOOM = 4;

/** The part of the photo the corner editor shows: zoomed so the plate spans about 60 % of the frame (a plate
 * is short and wide, so whole-photo handles would cover it and each other), centred on it, inside the photo.
 * x, y: top-left of the view, 0–1 of the photo; the view is 1/scale wide and high. */
export function plateView(quad: Point[]): { x: number; y: number; scale: number } {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const scale = Math.min(MAX_ZOOM, Math.max(1, PLATE_SHARE / Math.max(width, 1e-3)));
  const size = 1 / scale;
  const place = (centre: number) => Math.min(1 - size, Math.max(0, centre - size / 2));
  return { x: place((Math.max(...xs) + Math.min(...xs)) / 2), y: place((Math.max(...ys) + Math.min(...ys)) / 2), scale };
}
