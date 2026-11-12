import type { Box } from '../domain/templates';

export type Detection = { cls: 'car' | 'truck' | 'person'; score: number; box: Box };

export const MIN_SCORE = 0.5;

export const width = (b: Box): number => b.x1 - b.x0;
const height = (b: Box): number => b.y1 - b.y0;
const area = (b: Box): number => Math.max(0, width(b)) * Math.max(0, height(b));
export const center = (b: Box): { x: number; y: number } => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });

// Scales a box around the frame center (0.5, 0.5).
export const scaleBox = (b: Box, s: number): Box => ({
  x0: 0.5 + (b.x0 - 0.5) * s,
  y0: 0.5 + (b.y0 - 0.5) * s,
  x1: 0.5 + (b.x1 - 0.5) * s,
  y1: 0.5 + (b.y1 - 0.5) * s,
});

// A template drawn for one field of view, shown on a camera with another: same distance, same perspective.
export const silhouetteScale = (templateHfovDeg: number, deviceHfovDeg: number): number =>
  Math.tan((templateHfovDeg * Math.PI) / 360) / Math.tan((deviceHfovDeg * Math.PI) / 360);

const overlap = (a: Box, b: Box): number =>
  area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });

export const intersects = (a: Box, b: Box): boolean => overlap(a, b) > 0;

export function iou(a: Box, b: Box): number {
  const inter = overlap(a, b);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

// The car the user is photographing: the vehicle that best matches the template box, else the largest one.
export function pickTarget(dets: Detection[], expected: Box): Detection | null {
  const vehicles = dets.filter((d) => d.cls !== 'person' && d.score >= MIN_SCORE);
  if (vehicles.length === 0) return null;
  const byIou = vehicles.reduce((best, d) => (iou(d.box, expected) > iou(best.box, expected) ? d : best));
  if (iou(byIou.box, expected) > 0) return byIou;
  return vehicles.reduce((best, d) => (area(d.box) > area(best.box) ? d : best));
}

// The resizer turns each frame upright before the model sees it; VisionCamera's frame-to-camera conversion
// wants a point in the raw buffer. Inverse of its counter-rotation per frame orientation (normalized points).
export function uprightToBuffer(x: number, y: number, orientation: 'up' | 'down' | 'left' | 'right'): { x: number; y: number } {
  'worklet';
  if (orientation === 'down') return { x: 1 - x, y: 1 - y };
  if (orientation === 'left') return { x: y, y: 1 - x };
  if (orientation === 'right') return { x: 1 - y, y: x };
  return { x, y };
}
