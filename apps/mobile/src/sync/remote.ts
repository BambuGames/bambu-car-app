// The server side of the sync engine: Supabase tables and the private `originals` bucket.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Slot } from '../domain/slots';
import type { Vehicle } from '../domain/vehicle';
import type { DamageMap, Language, VehicleData } from '../domain/vehicleData';
import type { Database, Json } from '../lib/database.types';
import type { Make, Model } from '../local/catalog';
import type { Listing, ListingText } from '../local/listings';
import type { RemotePhoto } from '../local/photos';

type JsonObject = { [key: string]: Json | undefined };

export interface Remote {
  upsertVehicle(v: Vehicle): Promise<void>;
  uploadPhoto(path: string, localUri: string): Promise<void>;
  upsertPhoto(p: RemotePhoto & { capture: Record<string, unknown>; qc: Record<string, unknown> }): Promise<void>;
  fetchVehicles(galleryId: string): Promise<Vehicle[]>;
  upsertListing(l: Listing): Promise<void>;
  fetchListings(galleryId: string): Promise<Listing[]>;
  fetchListingTexts(galleryId: string): Promise<ListingText[]>;
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
            variant: v.data.variant,
            first_registration: v.data.firstRegistration,
            mileage_km: v.data.mileageKm,
            fuel: v.data.fuel,
            transmission: v.data.transmission,
            power_kw: v.data.powerKw,
            displacement_ccm: v.data.displacementCcm,
            drive: v.data.drive,
            color_exterior: v.data.colorExterior,
            color_interior: v.data.colorInterior,
            upholstery: v.data.upholstery,
            previous_owners: v.data.previousOwners,
            hu_until: v.data.huUntil,
            accident_free: v.data.accidentFree,
            service_book: v.data.serviceBook,
            non_smoker: v.data.nonSmoker,
            vin: v.data.vin,
            damage: v.damage as JsonObject,
            damage_checked_at: v.damageCheckedAt,
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
            qc: p.qc as JsonObject,
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
          .select(
            'id, gallery_id, make, model, body_type, status, details, created_at, updated_at, facts_updated_at, variant, first_registration, mileage_km, fuel, transmission, power_kw, displacement_ccm, drive, color_exterior, color_interior, upholstery, previous_owners, hu_until, accident_free, service_book, non_smoker, vin, damage, damage_checked_at',
          )
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
        data: {
          variant: r.variant,
          firstRegistration: r.first_registration,
          mileageKm: r.mileage_km,
          fuel: r.fuel,
          transmission: r.transmission,
          powerKw: r.power_kw,
          displacementCcm: r.displacement_ccm,
          drive: r.drive,
          colorExterior: r.color_exterior,
          colorInterior: r.color_interior,
          upholstery: r.upholstery,
          previousOwners: r.previous_owners,
          huUntil: r.hu_until,
          accidentFree: r.accident_free,
          serviceBook: r.service_book,
          nonSmoker: r.non_smoker,
          vin: r.vin,
        } as VehicleData,
        damage: (r.damage ?? {}) as DamageMap,
        damageCheckedAt: r.damage_checked_at ? iso(r.damage_checked_at) : null,
        details: (r.details ?? {}) as Vehicle['details'],
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
        factsUpdatedAt: iso(r.facts_updated_at), // the server's stamp; never sent (members cannot write it)
      }));
    },

    async upsertListing(l) {
      check(
        await client.from('listings').upsert(
          {
            id: l.id,
            gallery_id: l.galleryId,
            status: l.status,
            price_eur: l.priceEur,
            vat_deductible: l.vatDeductible,
            warranty_months: l.warrantyMonths,
            location: l.location,
            created_at: l.createdAt,
            updated_at: l.updatedAt,
          },
          { onConflict: 'id' },
        ),
      );
    },

    async fetchListings(galleryId) {
      const rows = await readAll((from, to) =>
        client.from('listings').select('*').eq('gallery_id', galleryId).order('id').range(from, to),
      );
      return rows.map((r) => ({
        id: r.id,
        galleryId: r.gallery_id,
        status: 'draft' as const,
        priceEur: r.price_eur,
        vatDeductible: r.vat_deductible,
        warrantyMonths: r.warranty_months,
        location: r.location,
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
        factsUpdatedAt: iso(r.facts_updated_at),
      }));
    },

    async fetchListingTexts(galleryId) {
      const rows = await readAll((from, to) =>
        client.from('listing_texts').select('*').eq('gallery_id', galleryId).order('listing_id').order('language').range(from, to),
      );
      return rows.map((r) => ({
        listingId: r.listing_id,
        language: r.language as Language,
        titles: r.titles,
        title: r.title,
        description: r.description,
        model: r.model,
        generatedAt: iso(r.generated_at),
        edited: r.edited,
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
