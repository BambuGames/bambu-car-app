import type { Language } from '../domain/vehicleData';
import type { Db } from './db';
import { enqueue } from './outbox';
import { defined } from './vehicles';

export type Listing = {
  id: string; // = vehicleId
  galleryId: string;
  status: 'draft';
  priceEur: number | null;
  vatDeductible: boolean | null;
  warrantyMonths: number | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  factsUpdatedAt: string; // last change of a sale field (the ones the listing text uses)
};
export type ListingText = {
  listingId: string;
  language: Language;
  titles: string[];
  title: string;
  description: string;
  model: string;
  generatedAt: string;
  edited: boolean;
  updatedAt: string;
};

type Row = {
  id: string;
  gallery_id: string;
  status: 'draft';
  price_eur: number | null;
  vat_deductible: number | null;
  warranty_months: number | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  facts_updated_at: string;
};
type TextRow = {
  listing_id: string;
  language: Language;
  titles: string;
  title: string;
  description: string;
  model: string;
  generated_at: string;
  edited: number;
  updated_at: string;
};

const toListing = (r: Row): Listing => ({
  id: r.id,
  galleryId: r.gallery_id,
  status: r.status,
  priceEur: r.price_eur,
  vatDeductible: r.vat_deductible === null ? null : r.vat_deductible === 1,
  warrantyMonths: r.warranty_months,
  location: r.location,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  factsUpdatedAt: r.facts_updated_at,
});

const toText = (r: TextRow): ListingText => ({
  listingId: r.listing_id,
  language: r.language,
  titles: JSON.parse(r.titles),
  title: r.title,
  description: r.description,
  model: r.model,
  generatedAt: r.generated_at,
  edited: r.edited === 1,
  updatedAt: r.updated_at,
});

const upsert = (db: Db, l: Listing) =>
  db.run(
    `insert into listings (id, gallery_id, status, price_eur, vat_deductible, warranty_months, location, created_at, updated_at, facts_updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (id) do update set gallery_id = excluded.gallery_id, status = excluded.status, price_eur = excluded.price_eur,
       vat_deductible = excluded.vat_deductible, warranty_months = excluded.warranty_months, location = excluded.location,
       updated_at = excluded.updated_at, facts_updated_at = excluded.facts_updated_at`,
    [l.id, l.galleryId, l.status, l.priceEur, l.vatDeductible === null ? null : l.vatDeductible ? 1 : 0, l.warrantyMonths, l.location, l.createdAt, l.updatedAt, l.factsUpdatedAt],
  );

export async function getListing(db: Db, vehicleId: string): Promise<Listing | null> {
  const row = await db.get<Row>('select * from listings where id = ?', [vehicleId]);
  return row ? toListing(row) : null;
}

const SALE_FIELDS = ['priceEur', 'vatDeductible', 'warrantyMonths', 'location'] as const;

export async function saveListing(
  db: Db,
  vehicleId: string,
  galleryId: string,
  patch: Partial<Pick<Listing, 'priceEur' | 'vatDeductible' | 'warrantyMonths' | 'location'>>,
  now: string,
): Promise<Listing> {
  let listing: Listing | undefined;
  await db.transaction(async () => {
    const current = await getListing(db, vehicleId); // inside, like updateVehicle
    listing = {
      id: vehicleId,
      galleryId,
      status: 'draft',
      priceEur: null,
      vatDeductible: null,
      warrantyMonths: null,
      location: null,
      createdAt: now,
      factsUpdatedAt: now,
      ...current,
      ...defined(patch),
      updatedAt: now,
    };
    if (!current || SALE_FIELDS.some((key) => current[key] !== listing![key])) listing.factsUpdatedAt = now;
    await upsert(db, listing);
    await enqueue(db, 'listing', vehicleId, Date.parse(now));
  });
  return listing!;
}

// Writes a listing pulled from the server; the caller skips listings with pending local changes (in one transaction).
export function upsertRemoteListing(db: Db, l: Listing): Promise<void> {
  return upsert(db, l);
}

export function cacheListingText(db: Db, t: ListingText): Promise<void> {
  return db.run(
    `insert into listing_texts (listing_id, language, titles, title, description, model, generated_at, edited, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (listing_id, language) do update set titles = excluded.titles, title = excluded.title,
       description = excluded.description, model = excluded.model, generated_at = excluded.generated_at,
       edited = excluded.edited, updated_at = excluded.updated_at`,
    [t.listingId, t.language, JSON.stringify(t.titles), t.title, t.description, t.model, t.generatedAt, t.edited ? 1 : 0, t.updatedAt],
  );
}

export async function getListingTexts(db: Db, listingId: string): Promise<ListingText[]> {
  const rows = await db.all<TextRow>('select * from listing_texts where listing_id = ? order by language', [listingId]);
  return rows.map(toText);
}
