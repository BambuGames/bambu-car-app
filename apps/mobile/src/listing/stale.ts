import type { ListingText } from '../local/listings';

// The vehicle data or the sale fields the text is written from changed after it was written: pass the vehicle's and
// the listing's factsUpdatedAt, not updatedAt (server bookkeeping moves that). ISO strings compare by time.
export const isStale = (text: ListingText, vehicleFactsAt: string, listingFactsAt: string | null): boolean =>
  Date.parse(vehicleFactsAt) > Date.parse(text.generatedAt) ||
  (listingFactsAt !== null && Date.parse(listingFactsAt) > Date.parse(text.generatedAt));
