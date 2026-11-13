// Touch-up edits (M0 decision): staff draw on the processed output; the edits are stored in 0–1 coordinates
// of the upright original, where the worker replays them on the stored mask (imaging.apply_edits).
import { OUTPUT, outputToOriginal, type Placement, type Point } from './geometry';
import type { MaskEdit } from './status';

const tuple = (p: Point): [number, number] => [p.x, p.y];

// The placement is a rotation and a uniform scale, so one column's length is the scale.
const scale = (p: Placement) => Math.hypot(p.m[0][0], p.m[1][0]);

export const toOriginalTap = (p: Placement, pt: Point): MaskEdit => ({ type: 'remove', point: tuple(outputToOriginal(p, pt)) });

// brushOutput is the brush radius as a share of the output's width; the worker wants it as a share of the
// original's width.
export const toOriginalStroke = (p: Placement, outputPoints: Point[], brushOutput: number): MaskEdit => ({
  type: 'erase',
  points: outputPoints.map((pt) => tuple(outputToOriginal(p, pt))),
  radius: (brushOutput * OUTPUT.width) / (scale(p) * p.src[0]),
});

// The other way, to draw a stored stroke over the output.
export const toOutputRadius = (p: Placement, radius: number): number => (radius * scale(p) * p.src[0]) / OUTPUT.width;

export const undo =(edits: MaskEdit[]): MaskEdit[] => edits.slice(0, -1);

export function simplify(points: Point[], minStep = 0.004): Point[] {
  const kept: Point[] = [];
  for (const pt of points) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= minStep) kept.push(pt);
  }
  return kept;
}
