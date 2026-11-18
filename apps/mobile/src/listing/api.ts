// The listing text (spec 5.6-5.7): writing and reworking through the write-listing function, and manual edits.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { Language } from '../domain/vehicleData';
import type { Database } from '../lib/database.types';
import type { ListingText } from '../local/listings';

export type ListingCommand = 'shorten' | 'more_professional' | 'highlight_equipment' | 'simplify' | 'translate';
export type ListingError = 'not_member' | 'ai_refused' | 'ai_failed' | 'daily_limit' | 'offline' | 'internal';
const KNOWN = new Set<string>(['not_member', 'ai_refused', 'ai_failed', 'daily_limit']);

type Generated = {
  listing_id: string; language: Language; titles: string[]; title: string; description: string;
  model: string; generated_at: string; edited: boolean;
};

export function createListingApi(client: SupabaseClient<Database>) {
  return {
    async generate(a: { vehicleId: string; language: Language; command?: ListingCommand; fromLanguage?: Language }): Promise<ListingText | { error: ListingError }> {
      const { data, error } = await client.functions.invoke<Generated>('write-listing', {
        body: { vehicle_id: a.vehicleId, language: a.language, command: a.command, from_language: a.fromLanguage },
      });
      if (!error && data) {
        return {
          listingId: data.listing_id, language: data.language, titles: data.titles, title: data.title, description: data.description,
          model: data.model, generatedAt: data.generated_at, edited: data.edited, updatedAt: data.generated_at,
        };
      }
      if (error instanceof FunctionsFetchError) return { error: 'offline' }; // never reached the function
      if (error instanceof FunctionsHttpError) {
        const code = await (error.context as Response)
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => undefined);
        if (code && KNOWN.has(code)) return { error: code as ListingError };
      }
      return { error: 'internal' };
    },

    // A manual correction: row-level security decides who may; the text counts as edited from now on
    // (picking one of the three titles keeps the flag as it was).
    async saveText(listingId: string, language: Language, fields: { title: string; description: string }, edited = true): Promise<void> {
      const { error } = await client.from('listing_texts').update({ ...fields, edited }).eq('listing_id', listingId).eq('language', language);
      if (error) throw error;
    },
  };
}
