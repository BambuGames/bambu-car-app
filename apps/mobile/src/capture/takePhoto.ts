// Takes the photo, runs the quality check (design 6.4) and moves the file into the app's documents.
import { Directory, File, Paths } from 'expo-file-system';
import type { Image } from 'react-native-nitro-image';
import type { CameraPhotoOutput } from 'react-native-vision-camera';

import { photoFileName, type QcIssue } from '../domain/capture';
import type { Slot } from '../domain/slots';
import type { Box } from '../domain/templates';
import { centerCrop43 } from './camera';
import { focal35FromJpeg } from './exif';
import { analyzeRgba, photoMetrics, qcIssues, toRgba, type PhotoMetrics, type QualityMetrics } from './quality';

export type TakenPhoto = {
  uri: string;
  width: number;
  height: number;
  metrics: PhotoMetrics;
  issues: QcIssue[];
  focal35: number | null;
  cropShare: number; // kept width / delivered width: 1 unless the photo was cut to 4:3
};

async function metricsAt(image: Image, width: number, height: number): Promise<QualityMetrics> {
  const small = await image.resizeAsync(width, height);
  try {
    const raw = await small.toRawPixelDataAsync();
    return analyzeRgba(toRgba(raw.buffer, raw.pixelFormat, raw.width, raw.height), raw.width, raw.height);
  } finally {
    small.dispose();
  }
}

export async function takePhoto(
  output: CameraPhotoOutput,
  ctx: { vehicleId: string; slot: Slot; capturedAt: string; target: Box | null; exterior: boolean; tilt: { rollDeg: number; pitchDeg: number } | null },
): Promise<TakenPhoto> {
  const photo = await output.capturePhoto({ flashMode: 'off' }, {});
  let image: Image | null = null;
  try {
    const file = new File(Paths.document, 'photos', photoFileName(ctx.vehicleId, ctx.slot, ctx.capturedAt));
    new Directory(Paths.document, 'photos', ctx.vehicleId).create({ intermediates: true, idempotent: true });
    const path = decodeURIComponent(file.uri.replace(/^file:\/\//, ''));
    await photo.saveToFileAsync(path);
    // Read before a crop rewrites the file without EXIF.
    // ponytail: reads the whole JPEG for its EXIF header; read only the first 64 KB if capture feels slow.
    const focal35 = focal35FromJpeg(new Uint8Array(await file.arrayBuffer()));

    image = await photo.toImageAsync(); // orientation applied, as the photo will be shown
    // A phone that ignored the 4:3 request keeps the middle 4:3, which is what its preview showed.
    const crop = centerCrop43(image.width, image.height);
    const cropShare = crop.width / image.width;
    if (cropShare < 1) {
      const full = image;
      image = await full.cropAsync(crop.x, crop.y, crop.x + crop.width, crop.y + crop.height);
      full.dispose();
      await image.saveToFileAsync(path, 'jpg', 92);
    }
    const landscape = image.width >= image.height;
    const metrics = photoMetrics(
      await metricsAt(image, landscape ? 640 : 480, landscape ? 480 : 640),
      await metricsAt(image, landscape ? 320 : 240, landscape ? 240 : 320),
    );
    const issues = qcIssues(metrics, { width: image.width, height: image.height, target: ctx.target, exterior: ctx.exterior, tilt: ctx.tilt });
    return { uri: file.uri, width: image.width, height: image.height, metrics, issues, focal35, cropShare };
  } finally {
    // Full-resolution buffers (tens of MB each): free them now, not when the GC gets round to it.
    image?.dispose();
    photo.dispose();
  }
}
