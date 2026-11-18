// The stored car mask at a small size, with the touch-up erase strokes painted over it as the worker will
// (imaging.apply_edits), so maskParts can tell what a remove tap would hit. Remove taps are left out: they
// only drop parts and do not change which part the car is.
import { AlphaType, ColorType, PaintStyle, Skia, StrokeCap, type SkImage } from '@shopify/react-native-skia';

import { cutWidth } from './maskParts';
import type { MaskEdit } from './status';

export function maskSnapshot(
  mask: SkImage,
  edits: MaskEdit[],
  width = 512,
): { alpha: Uint8Array; width: number; height: number } | null {
  const height = Math.max(1, Math.round((width * mask.height()) / mask.width()));
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.drawImageRect(mask, Skia.XYWHRect(0, 0, mask.width(), mask.height()), Skia.XYWHRect(0, 0, width, height), Skia.Paint());

  const brush = Skia.Paint();
  brush.setColor(Skia.Color('black'));
  brush.setStyle(PaintStyle.Stroke);
  brush.setStrokeCap(StrokeCap.Round);
  brush.setAntiAlias(false); // as the worker draws it: a soft edge would leave a thin cut joined
  for (const edit of edits) {
    if (edit.type !== 'erase' || edit.points.length === 0) continue;
    brush.setStrokeWidth(cutWidth(edit.radius, width));
    const path = Skia.PathBuilder.Make();
    const [first, ...rest] = edit.points;
    path.moveTo(first[0] * width, first[1] * height);
    // A single point is a dot: a zero-length round-capped line.
    for (const [x, y] of rest.length > 0 ? rest : [first]) path.lineTo(x * width, y * height);
    canvas.drawPath(path.detach(), brush);
  }
  surface.flush();

  const rgba = canvas.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!(rgba instanceof Uint8Array)) return null;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4]; // the mask is grey: red is the alpha
  return { alpha, width, height };
}
