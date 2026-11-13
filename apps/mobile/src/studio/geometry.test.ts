import { defaultPlateQuad, originalToOutput, outputToOriginal, type Placement } from './geometry';

// A 6° straightening composed with a placement, as the worker stores it (2×3, upright pixels → 2560×1920).
function straightenedPlacement(): Placement {
  const a = (-6 * Math.PI) / 180;
  const [w, h] = [4000, 3000];
  const rot = [
    [Math.cos(a), -Math.sin(a), w / 2 - Math.cos(a) * (w / 2) + Math.sin(a) * (h / 2)],
    [Math.sin(a), Math.cos(a), h / 2 - Math.sin(a) * (w / 2) - Math.cos(a) * (h / 2)],
  ];
  const s = 0.6;
  const place = [
    [s, 0, 80],
    [0, s, -40],
  ];
  const m = [0, 1].map((r) => [
    place[r][0] * rot[0][0] + place[r][1] * rot[1][0],
    place[r][0] * rot[0][1] + place[r][1] * rot[1][1],
    place[r][0] * rot[0][2] + place[r][1] * rot[1][2] + place[r][2],
  ]) as Placement['m'];
  return { m, src: [w, h] };
}

test('outputToOriginal undoes originalToOutput on a straightened photo', () => {
  const p = straightenedPlacement();
  for (const pt of [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.93, y: 0.71 }]) {
    const back = outputToOriginal(p, originalToOutput(p, pt));
    expect(back.x).toBeCloseTo(pt.x, 9);
    expect(back.y).toBeCloseTo(pt.y, 9);
  }
});

test('originalToOutput maps the plate the way the worker does', () => {
  const p: Placement = { m: [[2, 0, 100], [0, 2, 50]], src: [1000, 750] };
  const out = originalToOutput(p, { x: 0.5, y: 0.5 });
  expect(out.x).toBeCloseTo((2 * 500 + 100) / 2560, 12);
  expect(out.y).toBeCloseTo((2 * 375 + 50) / 1920, 12);
});

test('the default plate quad is a 520:110 plate in the lower middle of the photo', () => {
  const [tl, tr, br, bl] = defaultPlateQuad();
  const width = (tr.x - tl.x) * 2560;
  const height = (bl.y - tl.y) * 1920;
  expect(tr.x - tl.x).toBeCloseTo(0.2, 9);
  expect(width / height).toBeCloseTo(520 / 110, 6);
  expect(tl.y).toBeGreaterThan(0.5);
  expect(br).toEqual({ x: tr.x, y: bl.y });
});
