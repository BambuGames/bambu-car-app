// Draws the sales poster (layout A: photo on top, white information band below) offscreen and encodes it as
// a JPEG. It gets decoded images and typefaces, so it does no network work itself.
import {
  ImageFormat, Skia, type SkFont, type SkImage, type SkSurface, type SkTypeface,
} from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3/700Bold';
import { File, Paths } from 'expo-file-system';

import { POSTER_SIZE, fitFacts, fitTitle, type PosterFormat, type PosterModel } from './posterModel';

const MARGIN = 56;
const BAND_MIN = 400; // the band is as high as its content, never lower than this; the photo area takes the rest
const PAD = 44;
const LOGO_MAX_H = 120;
const INK = '#141414';
const MUTED = '#555555';

export type PosterFonts = { regular: SkTypeface; bold: SkTypeface };

async function typeface(mod: number): Promise<SkTypeface> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(data);
  data.dispose();
  if (!face) throw new Error('poster_font');
  return face;
}

let fontsLoad: Promise<PosterFonts> | null = null;

/** Loads the two typefaces once and reuses them; a failed load is not cached, so the next call retries. */
export function loadPosterFonts(): Promise<PosterFonts> {
  fontsLoad ??= (async () => {
    const results = await Promise.allSettled([typeface(SourceSans3_400Regular), typeface(SourceSans3_700Bold)]);
    if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
      return { regular: results[0].value, bold: results[1].value };
    }
    for (const r of results) if (r.status === 'fulfilled') r.value.dispose();
    throw new Error('poster_font');
  })().catch((e) => {
    fontsLoad = null;
    throw e;
  });
  return fontsLoad;
}

export function renderPoster(a: {
  photo: SkImage;
  logo: SkImage | null;
  model: PosterModel;
  format: PosterFormat;
  fonts: PosterFonts;
}): Uint8Array {
  const { photo, logo, model, format, fonts } = a;
  const { width: W, height: H } = POSTER_SIZE[format];
  const textW = W - 2 * MARGIN;

  const paint = Skia.Paint();
  const toDispose: { dispose(): void }[] = [paint];
  const font = (face: SkTypeface, size: number) => {
    const f = Skia.Font(face, size);
    toDispose.push(f);
    return f;
  };
  let surface: SkSurface | null = null;
  let snapshot: SkImage | undefined;
  try {
    // Plan first: the band is as high as what it holds.
    let logoW = 0;
    let logoH = 0;
    if (logo) {
      const h = Math.min(LOGO_MAX_H, logo.height());
      logoW = Math.min((logo.width() * h) / logo.height(), textW / 3);
      logoH = (logo.height() * logoW) / logo.width();
    }
    const lowW = logoW ? textW - logoW - 24 : textW;
    const measure = (f: SkFont) => (t: string) => f.measureText(t).width;
    const line = (s: string, f: SkFont, maxW: number) => fitTitle(s, maxW, 1, measure(f))[0] ?? '';

    const title = font(fonts.bold, 56);
    const titleLines = fitTitle(model.title, textW, 2, measure(title));
    const facts = font(fonts.regular, 34);
    const shownFacts = fitFacts(model.facts, textW, ' · ', measure(facts));
    let size = 72;
    let price = font(fonts.bold, size);
    while (size > 40 && price.measureText(model.price).width > textW) price = font(fonts.bold, (size -= 4));
    const note = font(fonts.regular, 30);
    const small = font(fonts.regular, 30);
    const contact = [
      model.contact?.phone ? `Tel. ${model.contact.phone}` : null,
      model.contact?.whatsapp ? `WhatsApp ${model.contact.whatsapp}` : null,
    ].filter((s): s is string => !!s);
    const lowLines = (contact.length ? 1 : 0) + (model.location ? 1 : 0);

    // Heights, top-down: baselines relative to the band top.
    let y = PAD;
    const baselines: number[] = [];
    for (let i = 0; i < titleLines.length; i++) baselines.push((y += 52)), (y += 12);
    const factsY = shownFacts.length ? (y += 36) : 0;
    if (shownFacts.length) y += 10;
    const priceY = (y += 18 + size * 0.75);
    const noteY = model.priceNote ? (y += 40) : 0;
    const topEnd = y + 10;
    const lowBlock = lowLines ? PAD + 8 + 42 * (lowLines - 1) + 30 : PAD;
    const band = Math.round(
      Math.max(BAND_MIN, topEnd + (lowLines ? 24 : 0) + lowBlock, logoH ? topEnd + 8 + logoH + PAD : 0),
    );
    const areaH = H - band;

    surface = Skia.Surface.MakeOffscreen(W, H);
    if (!surface) throw new Error('poster_surface');
    const canvas = surface.getCanvas();

    // Photo area: a photo wider than the area is fitted to the width and its top and bottom edge rows are
    // stretched into the gap (studio backdrops are a plain wall and floor); otherwise cover from the middle.
    const pw = photo.width();
    const ph = photo.height();
    if (pw / ph > W / areaH) {
      const h = (ph * W) / pw;
      const top = (areaH - h) / 2;
      const full = Skia.XYWHRect(0, 0, pw, ph);
      if (top > 0) {
        canvas.drawImageRect(photo, Skia.XYWHRect(0, 0, pw, 1), Skia.XYWHRect(0, 0, W, top + 1), paint);
        canvas.drawImageRect(photo, Skia.XYWHRect(0, ph - 1, pw, 1), Skia.XYWHRect(0, top + h - 1, W, top + 1), paint);
      }
      canvas.drawImageRect(photo, full, Skia.XYWHRect(0, top, W, h), paint);
    } else {
      const scale = Math.max(W / pw, areaH / ph);
      const sw = W / scale;
      const sh = areaH / scale;
      canvas.drawImageRect(photo, Skia.XYWHRect((pw - sw) / 2, (ph - sh) / 2, sw, sh), Skia.XYWHRect(0, 0, W, areaH), paint);
    }
    paint.setColor(Skia.Color('#FFFFFF'));
    canvas.drawRect(Skia.XYWHRect(0, areaH, W, band), paint);

    const text = (s: string, x: number, baseline: number, f: SkFont, color: string) => {
      paint.setColor(Skia.Color(color));
      canvas.drawText(s, x, areaH + baseline, paint, f);
    };
    if (logo) {
      canvas.drawImageRect(
        logo,
        Skia.XYWHRect(0, 0, logo.width(), logo.height()),
        Skia.XYWHRect(W - MARGIN - logoW, H - PAD - logoH, logoW, logoH),
        paint,
      );
    }
    titleLines.forEach((l, i) => text(l, MARGIN, baselines[i], title, INK));
    if (shownFacts.length) text(shownFacts.join(' · '), MARGIN, factsY, facts, MUTED);
    text(model.price, MARGIN, priceY, price, INK);
    if (model.priceNote) text(line(model.priceNote, note, textW), MARGIN, noteY, note, MUTED);

    // Bottom-up: location above the contact line.
    let by = band - PAD - 8;
    if (contact.length) {
      text(fitFacts(contact, lowW, '   ', measure(small)).join('   '), MARGIN, by, small, INK);
      by -= 42;
    }
    if (model.location) text(line(model.location, small, lowW), MARGIN, by, small, MUTED);

    surface.flush();
    snapshot = surface.makeImageSnapshot();
    return snapshot.encodeToBytes(ImageFormat.JPEG, 90);
  } finally {
    snapshot?.dispose();
    toDispose.forEach((o) => o.dispose());
    surface?.dispose();
  }
}

/** Writes the poster into the cache and returns the file path. */
export async function writePoster(bytes: Uint8Array, vehicleId: string, format: PosterFormat): Promise<string> {
  const file = new File(Paths.cache, `poster_${vehicleId}_${format.replace(':', 'x')}.jpg`);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}
