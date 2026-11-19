// The phone's side of export: write-only photo library access, temporary files in the cache, and the share
// sheet for one photo. save.ts gets these as its deps, so its logic stays testable in Jest.
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { studioApi } from '../studio/useStudio';
import type { ExportItem } from './plan';
import type { SaveDeps } from './save';

export async function signedUrl(bucket: ExportItem['bucket'], path: string): Promise<string> {
  const url = (await studioApi.signedUrls(bucket, [path]))[path];
  if (!url) throw new Error('no_signed_url');
  return url;
}

export async function toCache(url: string, name: string): Promise<string> {
  return (await File.downloadFileAsync(url, new File(Paths.cache, name), { idempotent: true })).uri;
}

function removeFile(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // Already gone; the cache is the system's to clear anyway.
  }
}

export const deviceSaveDeps: SaveDeps = {
  // Saving needs no read access (no granular media permissions): Android 13+ asks for nothing, older Android for
  // storage writing, iOS for "add only".
  requestPermission: async () => (await requestPermissionsAsync(true, [])).granted,
  signedUrl: (item) => signedUrl(item.bucket, item.path),
  download: toCache,
  saveToLibrary: async (uri) => {
    await Asset.create(uri);
  },
  remove: removeFile,
};

/** Opens the share sheet (AirDrop, mail, cloud drives) for one photo file. */
export async function sharePhoto(bucket: ExportItem['bucket'], path: string, name: string): Promise<void> {
  // The file stays in the cache: on Android the receiving app may read it after the sheet has closed, and the
  // system clears the cache itself.
  const uri = await toCache(await signedUrl(bucket, path), name);
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
}
