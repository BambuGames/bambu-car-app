// The server side of the sync engine: Supabase tables and the private `originals` bucket.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Slot } from '../domain/slots';
import type { Vehicle } from '../domain/vehicle';
import type { Database, Json } from '../lib/database.types';
import type { Make, Model } from '../local/catalog';
import type { RemotePhoto } from '../local/photos';

type JsonObject = { [key: string]: Json | undefined };

export interface Remote {
  upsertVehicle(v: Vehicle): Promise<void>;
  uploadPhoto(path: string, localUri: string): Promise<void>;
  upsertPhoto(p: RemotePhoto & { capture: Record<string, unknown> }): Promise<void>;
  fetchVehicles(galleryId: string): Promise<Vehicle[]>;
  fetchPhotos(galleryId: string): Promise<RemotePhoto[]>;
  fetchCatalog(): Promise<{ makes: Make[]; models: Model[] }>;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// Server timestamps come back as "+00:00"; store them in the same ISO form as local ones.
const iso = (timestamp: string) => new Date(timestamp).toISOString();

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

// PostgREST answers at most max_rows rows per request (1000 by default) and says nothing about the rest,
// so whole tables are read page by page. Each page starts after the rows actually received and only an
// empty page ends the read, so a server with a lower cap cannot make rows go missing.
export async function readAll<T>(page: Page<T>, size = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const batch = check(await page(rows.length, rows.length + size - 1)) ?? [];
    if (batch.length === 0) return rows;
    rows.push(...batch);
  }
}

export function createRemote(client: SupabaseClient<Database>, readFile: (uri: string) => Promise<ArrayBuffer>): Remote {
  return {
    async upsertVehicle(v) {
      check(
        await client.from('vehicles').upsert(
          {
            id: v.id,
            gallery_id: v.galleryId,
            make: v.make,
            model: v.model,
            body_type: v.bodyType,
            status: v.status,
            details: v.details as JsonObject,
            created_at: v.createdAt,
            updated_at: v.updatedAt,
          },
          { onConflict: 'id' },
        ),
      );
    },

    async uploadPhoto(path, localUri) {
      const bytes = await readFile(localUri);
      check(await client.storage.from('originals').upload(path, bytes, { contentType: 'image/jpeg', upsert: true }));
    },

    // One row per vehicle and slot: a photo of the same slot from another device is replaced.
    async upsertPhoto(p) {
      check(
        await client.from('photos').upsert(
          {
            id: p.id,
            vehicle_id: p.vehicleId,
            gallery_id: p.galleryId,
            slot: p.slot,
            original_path: p.originalPath,
            captured_at: p.capturedAt,
            capture: p.capture as JsonObject,
          },
          { onConflict: 'vehicle_id,slot' },
        ),
      );
    },

    // ponytail: full pull every sync, page by page; switch to updated_at-based incremental pulls when the
    // per-sync traffic matters (it grows with every vehicle and photo of the gallery).
    async fetchVehicles(galleryId) {
      const rows = await readAll((from, to) =>
        client
          .from('vehicles')
          .select('id, gallery_id, make, model, body_type, status, details, created_at, updated_at')
          .eq('gallery_id', galleryId)
          .order('id')
          .range(from, to),
      );
      return rows.map((r) => ({
        id: r.id,
        galleryId: r.gallery_id,
        make: r.make,
        model: r.model,
        bodyType: r.body_type,
        status: r.status,
        details: (r.details ?? {}) as Record<string, unknown>,
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
      }));
    },

    async fetchPhotos(galleryId) {
      const rows = await readAll((from, to) =>
        client
          .from('photos')
          .select('id, vehicle_id, gallery_id, slot, original_path, captured_at')
          .eq('gallery_id', galleryId)
          .order('id')
          .range(from, to),
      );
      return rows.map((r) => ({
        id: r.id,
        vehicleId: r.vehicle_id,
        galleryId: r.gallery_id,
        slot: r.slot as Slot,
        originalPath: r.original_path,
        capturedAt: iso(r.captured_at),
      }));
    },

    async fetchCatalog() {
      const makes = await readAll((from, to) => client.from('makes').select('id, name').order('id').range(from, to));
      const models = await readAll((from, to) =>
        client.from('models').select('id, make_id, name').order('id').range(from, to),
      );
      return { makes, models: models.map((m) => ({ id: m.id, makeId: m.make_id, name: m.name })) };
    },
  };
}
