// Dev tool: checks QC_LIMITS.minSharpness against sharp photos and blurred copies of them.
// usage: node scripts/qc-calibrate.mjs <folder with JPEGs>
// Each photo is scaled to 640×480 and 320×240 like on the phone; the blurred copies get a 5 px and a 9 px box
// blur at full size first.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import jpeg from 'jpeg-js';

import { analyzeRgba, photoMetrics, QC_LIMITS } from '../src/capture/quality.ts';

// Separable box blur over RGB, radius r (kernel 2r + 1), edges clamped.
function boxBlur({ width, height, data }, r) {
  const pass = (src, horizontal) => {
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let k = -r; k <= r; k++) {
            const xx = horizontal ? Math.min(width - 1, Math.max(0, x + k)) : x;
            const yy = horizontal ? y : Math.min(height - 1, Math.max(0, y + k));
            sum += src[(yy * width + xx) * 4 + c];
          }
          dst[(y * width + x) * 4 + c] = sum / (2 * r + 1);
        }
    return dst;
  };
  return { width, height, data: pass(pass(data, true), false) };
}

// Area average down to OUT_W×OUT_H (the photos are 4:3).
function downscale({ width, height, data }, OUT_W, OUT_H) {
  const out = new Uint8Array(OUT_W * OUT_H * 4);
  const sx = width / OUT_W;
  const sy = height / OUT_H;
  for (let y = 0; y < OUT_H; y++)
    for (let x = 0; x < OUT_W; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) sum += data[(yy * width + xx) * 4 + c];
        out[(y * OUT_W + x) * 4 + c] = sum / ((x1 - x0) * (y1 - y0));
      }
      out[(y * OUT_W + x) * 4 + 3] = 255;
    }
  return out;
}

const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

const sharpness = (img) =>
  photoMetrics(analyzeRgba(downscale(img, 640, 480), 640, 480), analyzeRgba(downscale(img, 320, 240), 320, 240)).sharpness;

const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f));
const runs = { sharp: [], blur5: [], blur9: [] };
for (const f of files) {
  const img = jpeg.decode(readFileSync(join(dir, f)), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  const row = { sharp: sharpness(img), blur5: sharpness(boxBlur(img, 2)), blur9: sharpness(boxBlur(img, 4)) };
  for (const k in row) runs[k].push(row[k]);
  console.log(`${f.padEnd(44)} sharp ${row.sharp.toFixed(2)}  blur5 ${row.blur5.toFixed(2)}  blur9 ${row.blur9.toFixed(2)}`);
}
const limit = QC_LIMITS.minSharpness;
console.log(`\n${files.length} photos; minSharpness ${limit}`);
for (const [k, xs] of Object.entries(runs)) {
  const flagged = xs.filter((x) => x < limit).length;
  console.log(`${k.padEnd(6)} min ${Math.min(...xs).toFixed(2)}  p5 ${pct(xs, 5).toFixed(2)}  median ${pct(xs, 50).toFixed(2)}  p95 ${pct(xs, 95).toFixed(2)}  max ${Math.max(...xs).toFixed(2)}  flagged ${flagged}/${xs.length}`);
}
