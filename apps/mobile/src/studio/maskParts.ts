// Which part of the car mask a "Teil entfernen" tap lands on (design 7.2.3, phone round 1). The worker removes
// only parts apart from the car (imaging.apply_edits): a tap on the car itself, or on something joined to it,
// did nothing and said nothing. Same rule as the worker: alpha >= 128, 8-connected, the largest part is the car.
import type { Point } from './geometry';

export type Parts = { labels: Int32Array; width: number; height: number; car: number };

export function labelParts(alpha: Uint8Array, width: number, height: number): Parts {
  const labels = new Int32Array(width * height);
  const stack: number[] = [];
  let next = 0;
  let car = 0;
  let carSize = 0;
  // ponytail: stack flood fill, fine for the 512 px snapshot; two-pass labelling if masks grow much larger.
  for (let start = 0; start < labels.length; start++) {
    if (alpha[start] < 128 || labels[start] !== 0) continue;
    next++;
    let size = 0;
    labels[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % width;
      const y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (alpha[j] >= 128 && labels[j] === 0) {
            labels[j] = next;
            stack.push(j);
          }
        }
      }
    }
    if (size > carSize) {
      car = next;
      carSize = size;
    }
  }
  return { labels, width, height, car };
}

/** What a remove tap at `p` (0–1 of the original) would do. Without a loaded mask every tap is accepted. */
export function judgeRemove(parts: Parts | null, p: Point): 'accept' | 'joined' | 'nothing' {
  if (!parts) return 'accept';
  const x = Math.min(parts.width - 1, Math.max(0, Math.floor(p.x * parts.width)));
  const y = Math.min(parts.height - 1, Math.max(0, Math.floor(p.y * parts.height)));
  const label = parts.labels[y * parts.width + x];
  if (label === 0) return 'nothing';
  return label === parts.car ? 'joined' : 'accept';
}

/** Width of an erase cut in the mask snapshot (`width` px wide): the worker's cut at full size, but at least
 * 3 px, so a fine cut made at high zoom still separates a part at snapshot size. */
export const cutWidth = (radius: number, width: number): number => Math.max(3, 2 * radius * width);
