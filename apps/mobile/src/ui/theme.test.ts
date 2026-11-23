import { colors } from './theme';

// WCAG 2.x contrast ratio between two #RRGGBB colours.
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const palette = colors as unknown as Record<string, string>;

test('text tokens meet AA on their grounds', () => {
  for (const ink of ['ink', 'ink2', 'mark', 'ok', 'wait']) {
    for (const ground of ['paper', 'sheet']) {
      expect([ink, ground, contrast(palette[ink], palette[ground])]).toEqual([ink, ground, expect.any(Number)]);
      expect(contrast(palette[ink], palette[ground])).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast(palette.onAction, palette.action)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.action, palette.paper)).toBeGreaterThanOrEqual(4.5);
});

test('field edges meet 3:1 on both grounds', () => {
  expect(contrast(palette.field, palette.sheet)).toBeGreaterThanOrEqual(3);
  expect(contrast(palette.field, palette.paper)).toBeGreaterThanOrEqual(3);
});

test('old token names are gone', () => {
  for (const old of ['background', 'surface', 'border', 'text', 'textMuted', 'accent', 'danger', 'pending']) {
    expect(Object.keys(colors)).not.toContain(old);
  }
});
