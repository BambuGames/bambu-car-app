import type { Detection } from './geometry';

// Indices in the detector's embedded COCO label map (0-based, checked against labelmap.txt in the model).
export const CLASS_IDS = { person: 0, car: 2, truck: 7 } as const;

// Outputs of the TFLite detection post-process op: boxes [ymin, xmin, ymax, xmax] normalized to the model
// input, which is the whole frame stretched; class ids and scores as floats; count of valid rows.
export function parseDetections(
  boxes: Float32Array,
  classes: Float32Array,
  scores: Float32Array,
  count: number,
  minScore = 0.5,
): Detection[] {
  'worklet';
  const out: Detection[] = [];
  for (let i = 0; i < count; i++) {
    if (scores[i] < minScore) continue;
    const id = Math.round(classes[i]);
    const cls = id === CLASS_IDS.car ? 'car' : id === CLASS_IDS.truck ? 'truck' : id === CLASS_IDS.person ? 'person' : null;
    if (cls === null) continue;
    out.push({
      cls,
      score: scores[i],
      box: { x0: boxes[i * 4 + 1], y0: boxes[i * 4], x1: boxes[i * 4 + 3], y1: boxes[i * 4 + 2] },
    });
  }
  return out;
}
