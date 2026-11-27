// A showroom background's 4:3 preview: the room seen into a corner, as the worker draws it from a diagonal
// slot. Four polygons that cover the frame without overlap, and a few floor joints.
type Point = [number, number];
type ShowroomSpec = { wall: string; ceiling: string; floor: string; grout: string };

function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * factor));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function showroomSwatch(
  spec: ShowroomSpec,
  w: number,
  h: number,
): { polygons: { fill: string; points: Point[] }[]; lines: { color: string; from: Point; to: Point }[] } {
  const cx = 0.58 * w;
  const left: Point[] = [[0, 0.12 * h], [cx, 0.28 * h], [cx, 0.62 * h], [0, 0.72 * h]];
  const right: Point[] = [[cx, 0.28 * h], [w, 0.1 * h], [w, 0.74 * h], [cx, 0.62 * h]];
  return {
    polygons: [
      { fill: spec.ceiling, points: [[0, 0], [w, 0], [w, 0.1 * h], [cx, 0.28 * h], [0, 0.12 * h]] },
      { fill: darken(spec.wall, 0.97), points: left },
      { fill: darken(spec.wall, 0.94), points: right },
      { fill: spec.floor, points: [[0, 0.72 * h], [cx, 0.62 * h], [w, 0.74 * h], [w, h], [0, h]] },
    ],
    // joints run from the wall bases toward the viewer
    lines: [
      { color: spec.grout, from: [cx, 0.62 * h], to: [0.3 * w, h] },
      { color: spec.grout, from: [0.25 * w, 0.68 * h], to: [0, 0.84 * h] },
      { color: spec.grout, from: [0.8 * w, 0.67 * h], to: [w, 0.86 * h] },
      { color: spec.grout, from: [0.15 * w, 0.83 * h], to: [w, 0.8 * h] },
    ],
  };
}
