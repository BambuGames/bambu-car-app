// Test-only in-memory server. Keeps one photo per vehicle and slot, like the real table.
import type { Vehicle } from '../domain/vehicle';
import type { RemotePhoto } from '../local/photos';
import type { Remote } from './remote';

type Name = keyof Remote;
type StoredPhoto = RemotePhoto & { capture: Record<string, unknown>; qc: Record<string, unknown> };

export class FakeRemote implements Remote {
  calls: { name: Name; args: unknown[] }[] = [];
  vehicles = new Map<string, Vehicle>();
  photos = new Map<string, StoredPhoto>(); // key: vehicleId/slot
  files = new Map<string, string>(); // storage path -> local uri that was uploaded
  beforeUpload?: () => Promise<void>; // runs while an upload is in flight
  private failures = new Set<Name>();

  failOnce(name: Name): void {
    this.failures.add(name);
  }

  private record(name: Name, args: unknown[]): void {
    this.calls.push({ name, args });
    if (this.failures.delete(name)) throw new Error(`${name} failed`);
  }

  async upsertVehicle(v: Vehicle) {
    this.record('upsertVehicle', [v]);
    this.vehicles.set(v.id, v);
  }

  async uploadPhoto(path: string, localUri: string) {
    await this.beforeUpload?.();
    this.record('uploadPhoto', [path, localUri]);
    this.files.set(path, localUri);
  }

  async upsertPhoto(p: StoredPhoto) {
    this.record('upsertPhoto', [p]);
    this.photos.set(`${p.vehicleId}/${p.slot}`, p);
  }

  async fetchVehicles(galleryId: string) {
    this.record('fetchVehicles', [galleryId]);
    return [...this.vehicles.values()].filter((v) => v.galleryId === galleryId);
  }

  async fetchPhotos(galleryId: string) {
    this.record('fetchPhotos', [galleryId]);
    return [...this.photos.values()].filter((p) => p.galleryId === galleryId).map(({ capture: _, ...p }) => p);
  }

  async fetchCatalog() {
    this.record('fetchCatalog', []);
    return { makes: [{ id: 1, name: 'Volkswagen' }], models: [{ id: 1, makeId: 1, name: 'Passat' }] };
  }
}
