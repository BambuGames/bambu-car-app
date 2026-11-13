// Between the processed output (2560×1920) and the upright original, where plate corners and touch-up edits
// are stored (0–1). `placement` is the worker's 2×3 matrix from original pixels to output pixels, horizon
// correction included.
export type Point = { x: number; y: number };
export type Placement = { m: [[number, number, number], [number, number, number]]; src: [number, number] };

export const OUTPUT = { width: 2560, height: 1920 };

export function originalToOutput(p: Placement, pt: Point): Point {
  const [[a, b, c], [d, e, f]] = p.m;
  const x = pt.x * p.src[0];
  const y = pt.y * p.src[1];
  return { x: (a * x + b * y + c) / OUTPUT.width, y: (d * x + e * y + f) / OUTPUT.height };
}

export function outputToOriginal(p: Placement, pt: Point): Point {
  const [[a, b, c], [d, e, f]] = p.m;
  const x = pt.x * OUTPUT.width - c;
  const y = pt.y * OUTPUT.height - f;
  const det = a * e - b * d;
  return { x: (e * x - b * y) / det / p.src[0], y: (a * y - d * x) / det / p.src[1] };
}

// Where staff start placing a plate the detector missed: 520:110, a fifth of the width, below the middle.
export function defaultPlateQuad(): Point[] {
  const w = 0.2;
  const h = (w * OUTPUT.width * (110 / 520)) / OUTPUT.height;
  const cx = 0.5;
  const cy = 0.68;
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}
