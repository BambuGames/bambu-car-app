// What the share screen sends and when it may send: pure helpers, so the logic stays testable in Jest.
import type { ListingText } from '../local/listings';
import type { PosterModel } from './posterModel';

/** The message that goes with the poster: the listing text, or title, facts and price when there is none. */
export function shareMessage(text: ListingText | null, model: PosterModel): string {
  return text ? `${text.title}\n\n${text.description}` : [model.title, model.facts.join(' · '), model.price].filter(Boolean).join('\n');
}

/** The worker covers a plate only with a banner and a placed plate; otherwise it can reach the public post. */
export function plateWarning(hasBanner: boolean, photos: { plate_status: string | null }[]): 'no_banner' | 'check' | null {
  if (!hasBanner) return 'no_banner';
  return photos.some((p) => p.plate_status === 'auto' || p.plate_status === 'needs_check') ? 'check' : null;
}

export function shareReadiness(a: { online: boolean; hasProcessedPhoto: boolean }): 'ok' | 'offline' | 'no_photos' {
  return !a.online ? 'offline' : !a.hasProcessedPhoto ? 'no_photos' : 'ok';
}

// react-native-share (12.x, src/index.tsx) throws exactly this when the sheet is dismissed with failOnCancel.
export const isShareCancel = (e: unknown): boolean => e instanceof Error && e.message === 'User did not share';
