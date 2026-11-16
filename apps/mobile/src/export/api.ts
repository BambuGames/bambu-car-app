// The ZIP link for a computer (spec 10), from the export-vehicle function.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import type { ExportVersion } from './plan';

export type ExportLinkError = 'not_member' | 'nothing_to_export' | 'worker_unreachable' | 'offline' | 'internal';
const KNOWN = new Set<string>(['not_member', 'nothing_to_export', 'worker_unreachable']);

export async function createExportLink(
  client: SupabaseClient<Database>,
  body: { vehicleId: string; version: ExportVersion; photoIds: string[] },
): Promise<{ url: string; expiresAt: string; count: number } | { error: ExportLinkError }> {
  const { data, error } = await client.functions.invoke<{ url: string; expiresAt: string; count: number }>('export-vehicle', { body });
  if (!error && data) return data;
  if (error instanceof FunctionsFetchError) return { error: 'offline' }; // never reached the function
  if (error instanceof FunctionsHttpError) {
    const code = await (error.context as Response)
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => undefined);
    if (code && KNOWN.has(code)) return { error: code as ExportLinkError };
  }
  return { error: 'internal' };
}
