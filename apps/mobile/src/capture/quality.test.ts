import { analyzeRgba, photoMetrics, qcIssues, toRgba } from './quality';

// Synthetic photos: a 128×96 "large" view and its 2×2-averaged 64×48 "small" view, like the 640×480 and
// 320×240 views of a real photo.
const W = 128;
const H = 96;

function rgba(w: number, h: number, value: (x: number, y: number) => number): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = value(x, y);
      px.set([v, v, v, 255], (y * w + x) * 4);
    }
  return px;
}
const checker = (lo: number, hi: number) =>
  rgba(W, H, (x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? hi : lo));

// Repeated box blur over the gray channel, clamped at the edges.
function blurred(px: Uint8Array, radius: number, passes: number): Uint8Array {
  let gray = Array.from({ length: W * H }, (_, i) => px[i * 4]);
  for (let p = 0; p < passes; p++) {
    const next = gray.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -radius; dy <= radius; dy++)
          for (let dx = -radius; dx <= radius; dx++) {
            sum += gray[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))];
            n++;
          }
        next[y * W + x] = Math.round(sum / n);
      }
    gray = next;
  }
  return rgba(W, H, (x, y) => gray[y * W + x]);
}

const half = (px: Uint8Array) =>
  rgba(W / 2, H / 2, (x, y) => {
    let sum = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sum += px[((2 * y + dy) * W + 2 * x + dx) * 4];
    return Math.round(sum / 4);
  });

const metrics = (large: Uint8Array) => photoMetrics(analyzeRgba(large, W, H), analyzeRgba(half(large), W / 2, H / 2));

const photo = (over: Partial<Parameters<typeof qcIssues>[1]> = {}) => ({
  width: 4032,
  height: 3024,
  target: { x0: 0.15, y0: 0.4, x1: 0.85, y1: 0.85 },
  exterior: true,
  ...over,
});

test('a sharp checkerboard is not blurry and a box-blurred copy is', () => {
  const sharp = metrics(checker(30, 220));
  const soft = metrics(blurred(checker(30, 220), 4, 3));
  expect(sharp.sharpness).toBeGreaterThan(0.35);
  expect(soft.sharpness).toBeLessThan(0.35);
  expect(qcIssues(sharp, photo())).toEqual([]);
  expect(qcIssues(soft, photo())).toEqual(['blurry']);
});

test('qcIssues flags dark and overexposed photos', () => {
  expect(qcIssues(metrics(checker(0, 60)), photo())).toEqual(['dark']);
  expect(qcIssues(metrics(checker(200, 255)), photo())).toEqual(['overexposed']);
});

test('qcIssues flags a car touching the frame edge only for exterior photos', () => {
  const m = metrics(checker(30, 220));
  const target = { x0: 0.005, y0: 0.3, x1: 0.7, y1: 0.8 };
  expect(qcIssues(m, photo({ target }))).toContain('cutOff');
  expect(qcIssues(m, photo({ target, exterior: false }))).not.toContain('cutOff');
  expect(qcIssues(m, photo({ target: null }))).not.toContain('cutOff');
});

test('qcIssues flags a photo that is not 4:3', () => {
  const m = metrics(checker(30, 220));
  expect(qcIssues(m, photo({ width: 1920, height: 1080 }))).toContain('aspect');
  expect(qcIssues(m, photo({ width: 4032, height: 3024 }))).not.toContain('aspect');
  expect(qcIssues(m, photo({ width: 3024, height: 4032 }))).toContain('aspect');
});

test('toRgba reorders the channel layouts the camera can return', () => {
  const px = (bytes: number[]) => new Uint8Array(bytes).buffer;
  expect([...toRgba(px([30, 20, 10, 255]), 'BGRA', 1, 1)]).toEqual([10, 20, 30, 255]);
  expect([...toRgba(px([255, 10, 20, 30]), 'ARGB', 1, 1)]).toEqual([10, 20, 30, 255]);
  expect([...toRgba(px([10, 20, 30, 0]), 'RGBX', 1, 1)]).toEqual([10, 20, 30, 255]);
  expect([...toRgba(px([10, 20, 30, 40, 50, 60]), 'RGB', 2, 1)]).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  expect(() => toRgba(px([0, 0, 0, 0]), 'unknown', 1, 1)).toThrow();
});
