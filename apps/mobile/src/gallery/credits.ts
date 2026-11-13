// The gallery's credit balance and its history (design 9). Owners read every row; staff only the balance.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';

export type CreditEntry = {
  amount: number;
  reason: Database['public']['Enums']['credit_reason'];
  vehicle: string | null;
  note: string | null;
  created_at: string;
};

export async function fetchCredits(client: SupabaseClient<Database>, galleryId: string): Promise<{ balance: number; entries: CreditEntry[] }> {
  const [balance, rows] = await Promise.all([
    client.rpc('gallery_credit_balance', { p_gallery_id: galleryId }),
    client
      .from('credit_ledger')
      .select('amount, reason, note, created_at, vehicle:vehicles(make, model)')
      .eq('gallery_id', galleryId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ]);
  if (balance.error) throw balance.error;
  if (rows.error) throw rows.error;
  return {
    balance: balance.data,
    entries: rows.data.map(({ vehicle, ...row }) => ({ ...row, vehicle: vehicle ? `${vehicle.make} ${vehicle.model}` : null })),
  };
}

export const entryLabel = (entry: CreditEntry, t: (key: string, options: { vehicle: string }) => string): string =>
  t(`credits.${entry.reason}`, { vehicle: entry.vehicle ?? '' });
