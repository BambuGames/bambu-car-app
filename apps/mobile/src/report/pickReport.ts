// Picks a report: one PDF from Files, or photos of its pages from the library. Photos are re-encoded to JPEG
// with the long side at most 2400 px (HEIC becomes JPEG on the way, spec 8); a PDF goes as it is.
import { FilterMode, ImageFormat, MipmapMode, Skia, type SkImage, type SkSurface } from '@shopify/react-native-skia';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { orientationMatrix, orientationToApply } from './orientation';

export type Picked = { bytes: Uint8Array; mime: 'application/pdf' | 'image/jpeg' };
export const MAX_FILES = 10;
export const MAX_BYTES = 20 * 1024 * 1024; // all files together, the function's limit
export const TOO_LARGE = 'too_large'; // thrown before a too large file is read into memory
const LONG_SIDE = 2400;

export async function pickPdf(): Promise<Picked[] | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  if ((asset.size ?? file.size) > MAX_BYTES) throw new Error(TOO_LARGE);
  return [{ bytes: new Uint8Array(await file.arrayBuffer()), mime: 'application/pdf' }];
}

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  exif: true, // the orientation tag, see toJpeg
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export async function pickPhotos(): Promise<Picked[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ ...OPTIONS, allowsMultipleSelection: true, selectionLimit: MAX_FILES });
  if (result.canceled) return null;
  const out: Picked[] = [];
  for (const asset of result.assets) out.push({ bytes: await toJpeg(asset), mime: 'image/jpeg' });
  return out;
}

// One page per shot: the camera opens again after every photo until the dealer cancels or ten pages are taken.
// The camera permission prompt belongs to the user; a refusal throws, which the screen shows as unreadable.
export async function takePhoto(): Promise<Picked[] | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('camera_denied');
  const out: Picked[] = [];
  while (out.length < MAX_FILES) {
    const result = await ImagePicker.launchCameraAsync(OPTIONS);
    if (result.canceled) break;
    out.push({ bytes: await toJpeg(result.assets[0]), mime: 'image/jpeg' });
  }
  return out.length > 0 ? out : null;
}

// Skia decodes the raw pixels and ignores the EXIF orientation tag (SkImage.MakeFromEncoded does not apply the
// codec origin), so the tag is applied here when drawing; see orientationToApply for when the picker already did it.
// Every native object is released before the next photo, so ten photos do not pile up.
async function toJpeg(asset: ImagePicker.ImagePickerAsset): Promise<Uint8Array> {
  const data = await Skia.Data.fromURI(asset.uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  data.dispose();
  if (!image) throw new Error('unreadable_image');
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  try {
    const w = image.width();
    const h = image.height();
    const tag = asset.exif?.Orientation ?? asset.exif?.['{TIFF}']?.Orientation;
    const o = orientationToApply(tag, { w, h }, { width: asset.width, height: asset.height }, Platform.OS === 'android');
    const { m, outW, outH } = orientationMatrix(o, w, h);
    const scale = Math.min(1, LONG_SIDE / Math.max(outW, outH));
    surface = Skia.Surface.Make(Math.round(outW * scale), Math.round(outH * scale));
    if (!surface) throw new Error('unreadable_image');
    const canvas = surface.getCanvas();
    canvas.scale(scale, scale);
    canvas.concat([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]);
    canvas.drawImageRectOptions(image, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, w, h), FilterMode.Linear, MipmapMode.Linear);
    surface.flush();
    snapshot = surface.makeImageSnapshot();
    return snapshot.encodeToBytes(ImageFormat.JPEG, 85);
  } finally {
    snapshot?.dispose();
    surface?.dispose();
    image.dispose();
  }
}
