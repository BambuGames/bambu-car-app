// Takes the photo, runs the quality check (design 6.4) and moves the file into the app's documents.
import { Directory, File, Paths } from 'expo-file-system';
import type { Image } from 'react-native-nitro-image';
import type { CameraPhotoOutput } from 'react-native-vision-camera';

import { photoFileName, type QcIssue } from '../domain/capture';
import type { Slot } from '../domain/slots';
import type { Box } from '../domain/templates';
import { focal35FromJpeg } from './exif';
import { analyzeRgba, photoMetrics, qcIssues, toRgba, type PhotoMetrics, type QualityMetrics } from './quality';

export type TakenPhoto = {
  uri: string;
  width: number;
  height: number;
  metrics: PhotoMetrics;
  issues: QcIssue[];
  focal35: number | null;
};

async function metricsAt(image: Image, width: number, height: number): Promise<QualityMetrics> {
  const raw = await (await image.resizeAsync(width, height)).toRawPixelDataAsync();
  return analyzeRgba(toRgba(raw.buffer, raw.pixelFormat, raw.width, raw.height), raw.width, raw.height);
}

export async function takePhoto(
  output: CameraPhotoOutput,
  ctx: { vehicleId: string; slot: Slot; capturedAt: string; target: Box | null; exterior: boolean },
): Promise<TakenPhoto> {
  const photo = await output.capturePhoto({ flashMode: 'off' }, {});
  const file = new File(Paths.document, 'photos', photoFileName(ctx.vehicleId, ctx.slot, ctx.capturedAt));
  new Directory(Paths.document, 'photos', ctx.vehicleId).create({ intermediates: true, idempotent: true });
  await photo.saveToFileAsync(decodeURIComponent(file.uri.replace(/^file:\/\//, '')));

  const image = await photo.toImageAsync(); // orientation applied, as the photo will be shown
  const landscape = image.width >= image.height;
  const metrics = photoMetrics(
    await metricsAt(image, landscape ? 640 : 480, landscape ? 480 : 640),
    await metricsAt(image, landscape ? 320 : 240, landscape ? 240 : 320),
  );
  const issues = qcIssues(metrics, { width: image.width, height: image.height, target: ctx.target, exterior: ctx.exterior });
  // ponytail: reads the whole JPEG for its EXIF header; read only the first 64 KB if capture feels slow.
  const focal35 = focal35FromJpeg(new Uint8Array(await file.arrayBuffer()));
  return { uri: file.uri, width: image.width, height: image.height, metrics, issues, focal35 };
}
