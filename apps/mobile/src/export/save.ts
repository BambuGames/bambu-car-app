// Saving a set into the phone's photos, one file at a time: a photo that fails is counted and the rest go
// on. The native parts come in through `deps` (device.ts), so this runs in Jest.
import type { ExportItem } from './plan';

export type SaveDeps = {
  /** Write-only access to the photo library. */
  requestPermission(): Promise<boolean>;
  signedUrl(item: ExportItem): Promise<string>;
  /** Downloads to a temporary file named `name` and returns its uri. */
  download(url: string, name: string): Promise<string>;
  saveToLibrary(uri: string): Promise<void>;
  remove(uri: string): void;
};

export async function saveToPhotos(
  items: ExportItem[],
  deps: SaveDeps,
  onProgress?: (done: number) => void,
): Promise<{ status: 'denied' } | { status: 'done'; saved: number; failed: number }> {
  if (!(await deps.requestPermission())) return { status: 'denied' };
  let saved = 0;
  let failed = 0;
  for (const item of items) {
    let uri: string | null = null;
    try {
      uri = await deps.download(await deps.signedUrl(item), item.name);
      await deps.saveToLibrary(uri);
      saved++;
    } catch {
      failed++;
    } finally {
      if (uri) deps.remove(uri);
      onProgress?.(saved + failed);
    }
  }
  return { status: 'done', saved, failed };
}
