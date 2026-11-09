import { EXTERIOR_SLOTS } from '../domain/slots';
import type { BodyType, Vehicle, VehicleStatus } from '../domain/vehicle';
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
  created_at: string;
  updated_at: string;
};

const toVehicle = (r: Row): Vehicle => ({
  id: r.id,
  galleryId: r.gallery_id,
  make: r.make,
  model: r.model,
  bodyType: r.body_type,
  status: r.status,
  details: JSON.parse(r.details),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const UPSERT = `insert into vehicles (id, gallery_id, make, model, body_type, status, details, created_at, updated_at)
  values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  on conflict (id) do update set gallery_id = excluded.gallery_id, make = excluded.make, model = excluded.model,
    body_type = excluded.body_type, status = excluded.status, details = excluded.details, updated_at = excluded.updated_at`;

const upsert = (db: Db, v: Vehicle) =>
  db.run(UPSERT, [v.id, v.galleryId, v.make, v.model, v.bodyType, v.status, JSON.stringify(v.details), v.createdAt, v.updatedAt]);

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
    details: {},
    createdAt: input.now,
    updatedAt: input.now,
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

// Writes a vehicle pulled from the server; the caller skips vehicles with pending local changes.
export function upsertRemoteVehicle(db: Db, v: Vehicle): Promise<void> {
  return upsert(db, v);
}
