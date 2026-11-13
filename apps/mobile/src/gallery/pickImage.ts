// Picks a logo or plate banner from the photo library and turns it into the PNG the worker reads: a logo
// keeps its transparency, a banner is cut to the plate's shape. Android lets staff place the banner crop
// themselves; iOS crops only to a square, so there the middle is taken.
import { FilterMode, ImageFormat, MipmapMode, Skia } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { brandingCrop } from './branding';

export async function pickBrandingImage(kind: 'logo' | 'banner'): Promise<{ png: Uint8Array; aspect: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: kind === 'banner' && Platform.OS === 'android',
    aspect: [520, 110],
    quality: 1,
    // iOS: camera photos come as JPEG instead of HEIC, which Skia cannot decode; a PNG stays a PNG (the picker
    // writes PNGs as PNG), so a transparent logo keeps its transparency.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;

  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(result.assets[0].uri));
  if (!image) throw new Error('unreadable_image');
  const { src, out } = brandingCrop(kind, image.width(), image.height());
  const surface = Skia.Surface.Make(out.w, out.h);
  if (!surface) throw new Error('unreadable_image');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(src.x, src.y, src.w, src.h),
    Skia.XYWHRect(0, 0, out.w, out.h),
    FilterMode.Linear,
    MipmapMode.Linear,
  );
  surface.flush();
  return { png: surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100), aspect: out.w / out.h };
}
