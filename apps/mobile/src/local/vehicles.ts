import { EXTERIOR_SLOTS } from '../domain/slots';
import type { BodyType, Vehicle, VehicleStatus } from '../domain/vehicle';
import { emptyVehicleData, validateVehicleData, type VehicleData } from '../domain/vehicleData';
import type { Db } from './db';
import { enqueue } from './outbox';

export type VehicleListItem = Vehicle & { exteriorDone: number; pendingUploads: number };

type Row = {
  id: string;
  gallery_id: string;
  make: string;
  model: string;
  body_type: BodyType;
  status: VehicleStatus;
  details: string;
  damage: string;
  damage_checked_at: string | null;
  created_at: string;
  updated_at: string;
  facts_updated_at: string;
} & Record<string, string | number | null>;

// VehicleData key -> column; booleans are stored as 0/1 (null stays null).
const DATA_COLUMNS: [keyof VehicleData, string][] = [
  ['variant', 'variant'], ['firstRegistration', 'first_registration'], ['mileageKm', 'mileage_km'], ['fuel', 'fuel'],
  ['transmission', 'transmission'], ['powerKw', 'power_kw'], ['displacementCcm', 'displacement_ccm'], ['drive', 'drive'],
  ['colorExterior', 'color_exterior'], ['colorInterior', 'color_interior'], ['upholstery', 'upholstery'],
  ['previousOwners', 'previous_owners'], ['huUntil', 'hu_until'], ['accidentFree', 'accident_free'],
  ['serviceBook', 'service_book'], ['nonSmoker', 'non_smoker'], ['vin', 'vin'],
];
const BOOLEANS = new Set<keyof VehicleData>(['accidentFree', 'serviceBook', 'nonSmoker']);

const toVehicle = (r: Row): Vehicle => ({
  id: r.id,
  galleryId: r.gallery_id,
  make: r.make,
  model: r.model,
  bodyType: r.body_type,
  status: r.status,
  data: Object.fromEntries(
    DATA_COLUMNS.map(([key, column]) => [key, BOOLEANS.has(key) && r[column] !== null ? r[column] === 1 : r[column]]),
  ) as VehicleData,
  damage: JSON.parse(r.damage),
  damageCheckedAt: r.damage_checked_at,
  details: JSON.parse(r.details),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  factsUpdatedAt: r.facts_updated_at,
});

const COLUMNS = ['id', 'gallery_id', 'make', 'model', 'body_type', 'status', 'details', 'damage', 'damage_checked_at',
  'created_at', 'updated_at', 'facts_updated_at', ...DATA_COLUMNS.map(([, column]) => column)];
const UPSERT = `insert into vehicles (${COLUMNS.join(', ')}) values (${COLUMNS.map(() => '?').join(', ')})
  on conflict (id) do update set ${COLUMNS.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `${c} = excluded.${c}`).join(', ')}`;

const upsert = (db: Db, v: Vehicle) =>
  db.run(UPSERT, [
    v.id, v.galleryId, v.make, v.model, v.bodyType, v.status, JSON.stringify(v.details), JSON.stringify(v.damage),
    v.damageCheckedAt, v.createdAt, v.updatedAt, v.factsUpdatedAt,
    ...DATA_COLUMNS.map(([key]) => {
      const value = v.data[key];
      return typeof value === 'boolean' ? (value ? 1 : 0) : value;
    }),
  ]);

export async function createVehicle(
  db: Db,
  input: { id: string; galleryId: string; make: string; model: string; bodyType: BodyType; now: string },
): Promise<Vehicle> {
  const vehicle: Vehicle = {
    id: input.id,
    galleryId: input.galleryId,
    make: input.make,
    model: input.model,
    bodyType: input.bodyType,
    status: 'draft',
    data: emptyVehicleData(),
    damage: {},
    damageCheckedAt: null,
    details: {},
    createdAt: input.now,
    updatedAt: input.now,
    factsUpdatedAt: input.now,
  };
  await db.transaction(async () => {
    await upsert(db, vehicle);
    await enqueue(db, 'vehicle', vehicle.id, Date.parse(input.now));
  });
  return vehicle;
}

export async function getVehicle(db: Db, id: string): Promise<Vehicle | null> {
  const row = await db.get<Row>('select * from vehicles where id = ?', [id]);
  return row ? toVehicle(row) : null;
}

export async function listVehicles(db: Db, galleryId: string): Promise<VehicleListItem[]> {
  const exterior = EXTERIOR_SLOTS.map(() => '?').join(', ');
  const rows = await db.all<Row & { exterior_done: number; pending_uploads: number }>(
    `select v.*,
       (select count(*) from photos p where p.vehicle_id = v.id and p.slot in (${exterior})) as exterior_done,
       (select count(*) from photos p where p.vehicle_id = v.id
          and p.upload_state in ('pending', 'uploading', 'failed')) as pending_uploads
     from vehicles v
     where v.gallery_id = ? and v.status <> 'archived'
     order by v.created_at desc`,
    [...EXTERIOR_SLOTS, galleryId],
  );
  return rows.map((r) => ({ ...toVehicle(r), exteriorDone: r.exterior_done, pendingUploads: r.pending_uploads }));
}

// Writes a vehicle pulled from the server; the caller skips vehicles with pending local changes (in one transaction).
export function upsertRemoteVehicle(db: Db, v: Vehicle): Promise<void> {
  return upsert(db, v);
}

// What the listing text is written from (write-listing's columns, never the VIN): a change here makes a text stale.
// The server stamps its own copy the same way (vehicles_stamp_facts); the pull brings that one.
const facts = (v: Vehicle) =>
  JSON.stringify([v.make, v.model, v.bodyType, { ...v.data, vin: null }, v.details, v.damage, v.damageCheckedAt]);

// undefined means "not part of this patch"; null clears a field.
export const defined = <T extends object>(o: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;

export type VehiclePatch = Partial<Pick<Vehicle, 'make' | 'model' | 'bodyType' | 'data' | 'damage' | 'damageCheckedAt' | 'details'>>;

// data merges field by field, details key by key; an invalid data value throws and nothing is written.
// The current row is read inside the transaction, so overlapping edits (autosave per keystroke) build on each other.
export async function updateVehicle(db: Db, id: string, patch: VehiclePatch, now: string): Promise<Vehicle> {
  const { data: rawData, details: rawDetails, ...rawRest } = patch;
  const data = defined(rawData);
  const details = defined(rawDetails);
  const rest = defined(rawRest);
  if (Object.keys(validateVehicleData(data)).length > 0) throw new Error('invalid');
  let next: Vehicle | undefined;
  await db.transaction(async () => {
    const current = await getVehicle(db, id);
    if (!current) throw new Error('not_found');
    next = {
      ...current,
      ...rest,
      data: { ...current.data, ...data },
      details: { ...current.details, ...details },
      updatedAt: now,
    };
    if (facts(next) !== facts(current)) next.factsUpdatedAt = now;
    await upsert(db, next);
    await enqueue(db, 'vehicle', id, Date.parse(now));
  });
  return next!;
}
