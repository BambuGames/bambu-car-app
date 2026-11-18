// Report reading (spec 5.6): upload to the private reports bucket, the read-report function, and closing the read.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { DamagePart, DamageState, Equipment, VehicleData } from '../domain/vehicleData';
import type { Database } from '../lib/database.types';

export type ReportError = 'bad_request' | 'not_member' | 'ai_refused' | 'ai_failed' | 'daily_limit' | 'offline' | 'internal';
const KNOWN = new Set<string>(['bad_request', 'not_member', 'ai_refused', 'ai_failed', 'daily_limit']);

export type Suggestion =
  | { kind: 'field'; field: keyof VehicleData | 'make' | 'model'; value: string | number | boolean; quote: string }
  | { kind: 'damage'; part: DamagePart; state: Exclude<DamageState, 'original'>; quote: string }
  | { kind: 'equipment'; code: Equipment; quote: string };

export type ReportFile = { bytes: Uint8Array; mime: string; name: string };
export type OpenRead = { id: string; files: string[]; suggestions: Suggestion[] };

export function createReportApi(client: SupabaseClient<Database>) {
  return {
    // Paths are {gallery}/{vehicle}/{read}/{name}; the caller picks names like 1.pdf, 2.jpg.
    async upload(galleryId: string, vehicleId: string, readId: string, files: ReportFile[]): Promise<string[]> {
      const paths: string[] = [];
      for (const file of files) {
        const path = `${galleryId}/${vehicleId}/${readId}/${file.name}`;
        const { error } = await client.storage.from('reports').upload(path, file.bytes, { contentType: file.mime });
        if (error) {
          await client.storage.from('reports').remove(paths).catch(() => undefined); // best effort; clean-reports deletes leftovers after 7 days
          throw error;
        }
        paths.push(path);
      }
      return paths;
    },

    async read(vehicleId: string, readId: string, paths: string[]): Promise<{ suggestions: Suggestion[] } | { error: ReportError }> {
      const { data, error } = await client.functions.invoke<{ suggestions: Suggestion[] }>('read-report', {
        body: { vehicle_id: vehicleId, read_id: readId, files: paths },
      });
      if (!error && data) return { suggestions: data.suggestions };
      if (error instanceof FunctionsFetchError) return { error: 'offline' }; // never reached the function
      if (error instanceof FunctionsHttpError) {
        const code = await (error.context as Response)
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => undefined);
        if (code && KNOWN.has(code)) return { error: code as ReportError };
      }
      return { error: 'internal' };
    },

    // A finished read: the files go, the suggestions are emptied, the row is marked closed. It can be called again after
    // a partial failure: the files are judged by what is left in the read's folder, not by what remove reports (a
    // second remove reports nothing). A denied update or delete is silent under row-level security, so the update
    // must return its row.
    async close(readId: string, paths: string[]): Promise<void> {
      const removed = await client.storage.from('reports').remove(paths);
      if (removed.error) throw removed.error;
      const folders = [...new Set(paths.map((p) => p.slice(0, p.lastIndexOf('/'))))];
      for (const folder of folders) {
        const left = await client.storage.from('reports').list(folder);
        if (left.error) throw left.error;
        if (left.data.some((f) => paths.includes(`${folder}/${f.name}`))) throw new Error('close_files_not_deleted');
      }
      const { data, error } = await client
        .from('report_reads')
        .update({ suggestions: null, closed_at: new Date().toISOString() })
        .eq('id', readId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('close_read_not_updated');
    },

    // The newest finished read of a vehicle that nobody has closed yet, so a screen closed halfway can go on.
    async openRead(vehicleId: string): Promise<OpenRead | null> {
      const { data, error } = await client
        .from('report_reads')
        .select('id, files, suggestions')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'done')
        .is('closed_at', null)
        .not('suggestions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data && Array.isArray(data.suggestions) ? { id: data.id, files: data.files, suggestions: data.suggestions as Suggestion[] } : null;
    },
  };
}
