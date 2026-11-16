// Export (spec 10): which files a set holds, in listing order, named `01_<slot>.jpg`. The worker's
// export_name (services/image-worker/worker/export.py) gives the ZIP the same names.
import type { Slot } from '../domain/slots';
import { orderPhotos } from '../studio/order';
import type { StudioPhoto } from '../studio/status';

export type ExportVersion = 'watermarked' | 'plain' | 'originals';
export type ExportItem = { photoId: string; bucket: 'processed' | 'originals'; path: string; name: string };

export const exportName = (index: number, slot: Slot): string => `${String(index + 1).padStart(2, '0')}_${slot}.jpg`;

function pathOf(p: StudioPhoto, version: ExportVersion): string | null {
  if (version === 'originals') return p.original_path;
  if (p.process_status !== 'done') return null;
  return version === 'watermarked' ? p.output_wm_path : p.output_path;
}

/** The photos of a set that have the chosen version, numbered without gaps. No selection means all. */
export function exportItems(photos: StudioPhoto[], version: ExportVersion, selected?: ReadonlySet<string>): ExportItem[] {
  return orderPhotos(photos)
    .filter((p) => (!selected || selected.has(p.id)) && pathOf(p, version))
    .map((p, i) => ({ photoId: p.id, bucket: version === 'originals' ? 'originals' : 'processed', path: pathOf(p, version)!, name: exportName(i, p.slot) }));
}
