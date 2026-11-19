// Gallery contact numbers (spec 6.1). Light validation, stored as typed; owner only (RLS).
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';

const PHONE = /^[0-9 +\-/()]{1,30}$/;

/** Trimmed text when it is a plausible number, null when empty, 'invalid' otherwise. */
export function normalizePhone(input: string): string | null | 'invalid' {
  const v = input.trim();
  if (!v) return null;
  return PHONE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 6 ? v : 'invalid';
}

/** An RLS no-op for staff is reported as not_owner. */
export async function saveContact(
  client: SupabaseClient<Database>,
  galleryId: string,
  c: Partial<{ phone: string | null; whatsapp: string | null }>,
): Promise<void | { error: 'not_owner' }> {
  const { data, error } = await client.from('galleries').update(c).eq('id', galleryId).select('id');
  if (error) throw error;
  if (data.length === 0) return { error: 'not_owner' };
}
