// The app's copy of the worker's watermark layout (services/image-worker/worker/watermark.py), so the preview
// in the gallery settings shows the logo where the rendered photo will have it. Keep the two in step.
export type WatermarkPosition = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center';
export type WatermarkBand = { edge: 'top' | 'bottom'; color: string; height?: number };
export type WatermarkSettings = { position: WatermarkPosition; width: number; opacity: number; band: WatermarkBand | null };

export const WATERMARK_DEFAULTS: WatermarkSettings = { position: 'bottom_right', width: 0.18, opacity: 0.85, band: null };
const MARGIN = 0.03; // of the image width

const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Python's int(round(x)): halves go to the even neighbour.
function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// Stored settings as the worker reads them: missing or null keys fall back to the defaults.
export function withDefaults(stored: Partial<WatermarkSettings> | null | undefined): WatermarkSettings {
  const set = Object.fromEntries(Object.entries(stored ?? {}).filter(([, v]) => v !== null && v !== undefined));
  return { ...WATERMARK_DEFAULTS, ...set };
}

/** logoAspect is the logo's width / height, or null when the gallery has no logo. */
export function watermarkLayout(
  settings: Partial<WatermarkSettings> | null | undefined,
  logoAspect: number | null,
  width: number,
  height: number,
): {
  band: { y: number; h: number; color: string } | null;
  logo: { x: number; y: number; w: number; h: number; opacity: number } | null;
} {
  const s = withDefaults(settings);
  let band: { y: number; h: number; color: string } | null = null;
  if (s.band) {
    const h = pyRound(clip(s.band.height ?? 0.08, 0.04, 0.15) * height);
    band = { y: s.band.edge === 'top' ? 0 : height - h, h, color: s.band.color ?? '#000000' };
  }
  if (logoAspect === null) return { band, logo: null };

  let w = pyRound(clip(s.width, 0.05, 0.4) * width);
  let h = Math.max(1, pyRound(w / logoAspect));
  if (band) {
    // The logo fits inside the band.
    const maxH = Math.trunc(0.7 * band.h);
    if (h > maxH) {
      w = Math.max(1, pyRound((w * maxH) / h));
      h = maxH;
    }
  }
  const margin = pyRound(MARGIN * width);
  const p = s.position;
  const x = p === 'center' ? Math.floor((width - w) / 2) : p.endsWith('left') ? margin : width - margin - w;
  let y: number;
  if (band) y = band.y + Math.floor((band.h - h) / 2);
  else if (p === 'center') y = Math.floor((height - h) / 2);
  else if (p.startsWith('top')) y = margin;
  else y = height - margin - h;
  return { band, logo: { x, y, w, h, opacity: clip(s.opacity, 0, 1) } };
}
