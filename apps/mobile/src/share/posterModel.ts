import type { TFunction } from 'i18next';

import type { Language } from '../domain/vehicleData';
import type { Vehicle } from '../domain/vehicle';
import type { GalleryBranding } from '../gallery/branding';
import type { Listing } from '../local/listings';

export type PosterFormat = '4:5' | '9:16';
export const POSTER_SIZE: Record<PosterFormat, { width: number; height: number }> = {
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
};

export type PosterModel = {
  title: string;
  facts: string[];
  price: string;
  priceNote: string | null;
  location: string | null;
  contact: { phone: string | null; whatsapp: string | null } | null;
};

const LOCALE: Record<Language, string> = { de: 'de-DE', tr: 'tr-TR', en: 'en-GB' };

// Reads only make, model, variant, first registration, mileage, fuel, transmission: never the VIN or plate.
export function posterModel(
  v: Vehicle,
  l: Listing | null,
  g: Pick<GalleryBranding, 'phone' | 'whatsapp'>,
  lang: Language,
  t: TFunction,
): PosterModel {
  const d = v.data;
  const locale = LOCALE[lang];
  const reg = d.firstRegistration?.match(/^(\d{4})-(\d{2})/);
  const facts = [
    reg ? `${reg[2]}/${reg[1]}` : null,
    d.mileageKm != null ? `${new Intl.NumberFormat(locale).format(d.mileageKm)} km` : null,
    d.fuel ? t(`vehicleData.values.FUELS.${d.fuel}`) : null,
    d.transmission ? t(`vehicleData.values.TRANSMISSIONS.${d.transmission}`) : null,
  ].filter((x): x is string => !!x);
  const note = [
    l?.vatDeductible ? t('share.poster.vatDeductible') : null,
    l?.warrantyMonths ? t('share.poster.warranty', { months: l.warrantyMonths }) : null,
  ].filter((x): x is string => !!x);
  return {
    title: [v.make, v.model, d.variant].filter(Boolean).join(' '),
    facts,
    price:
      l?.priceEur != null
        ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(l.priceEur)
        : t('share.poster.priceOnRequest'),
    priceNote: note.length ? note.join(' · ') : null,
    location: l?.location || null,
    contact: g.phone || g.whatsapp ? { phone: g.phone, whatsapp: g.whatsapp } : null,
  };
}

const ellipsize = (text: string, maxWidth: number, measure: (s: string) => number): string => {
  if (measure(text) <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && measure(`${s}…`) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
};

// Greedy word wrap; whatever does not fit the last line is cut with "…". A single word wider than a line is cut with "…" too.
export function fitTitle(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines - 1) {
    let line = words[i++];
    while (i < words.length && measure(`${line} ${words[i]}`) <= maxWidth) line += ` ${words[i++]}`;
    lines.push(ellipsize(line, maxWidth, measure));
  }
  if (i < words.length) lines.push(ellipsize(words.slice(i).join(' '), maxWidth, measure));
  return lines;
}

// Drops items from the end until the joined line fits; the first item always stays.
export function fitFacts(items: string[], maxWidth: number, separator: string, measure: (s: string) => number): string[] {
  const kept = [...items];
  while (kept.length > 1 && measure(kept.join(separator)) > maxWidth) kept.pop();
  return kept;
}
