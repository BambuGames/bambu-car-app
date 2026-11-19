// Gallery branding (design 7.2.9, 9): logo, plate banner, watermark settings and the default studio. Owner only;
// RLS turns a staff update into "no row changed", which these functions report as not_owner.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '../lib/database.types';
import type { Background } from '../studio/api';
import { withDefaults, type WatermarkSettings } from './watermarkLayout';

type Client = SupabaseClient<Database>;
export type GalleryBranding = {
  logo_path: string | null;
  banner_path: string | null;
  watermark: WatermarkSettings;
  default_background_id: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export async function fetchGallerySettings(
  client: Client,
  galleryId: string,
): Promise<{ gallery: GalleryBranding; backgrounds: Background[]; latestOutput: string | null }> {
  const [gallery, backgrounds, latest] = await Promise.all([
    client.from('galleries').select('logo_path, banner_path, watermark, default_background_id, phone, whatsapp').eq('id', galleryId).single(),
    client.from('backgrounds').select('id, gallery_id, name, spec, sort_order').order('sort_order'),
    client
      .from('photos')
      .select('output_path')
      .eq('gallery_id', galleryId)
      .not('output_path', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(1),
  ]);
  if (gallery.error) throw gallery.error;
  if (backgrounds.error) throw backgrounds.error;
  if (latest.error) throw latest.error;
  return {
    gallery: { ...gallery.data, watermark: withDefaults(gallery.data.watermark as Partial<WatermarkSettings>) },
    backgrounds: backgrounds.data as unknown as Background[],
    latestOutput: latest.data[0]?.output_path ?? null,
  };
}

async function updateGallery(client: Client, galleryId: string, fields: Database['public']['Tables']['galleries']['Update']) {
  const { data, error } = await client.from('galleries').update(fields).eq('id', galleryId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('not_owner');
}

export const saveWatermark = (client: Client, galleryId: string, settings: WatermarkSettings) =>
  updateGallery(client, galleryId, { watermark: settings as unknown as NonNullable<Json> });

export const setDefaultBackground = (client: Client, galleryId: string, backgroundId: string) =>
  updateGallery(client, galleryId, { default_background_id: backgroundId });

const PLATE = 520 / 110; // the banner covers a German plate
const LOGO_MAX = 1200;
const BANNER_WIDTH = 1040;

/** Which part of a picked image to keep and the size to store it at: a logo as it is (scaled down to
 * 1200 px at most), a banner cut from the middle to the plate's shape. */
export function brandingCrop(kind: 'logo' | 'banner', w: number, h: number) {
  if (kind === 'logo') {
    const scale = Math.min(1, LOGO_MAX / Math.max(w, h));
    return { src: { x: 0, y: 0, w, h }, out: { w: Math.round(w * scale), h: Math.round(h * scale) } };
  }
  const src = w / h > PLATE ? { x: 0, y: 0, w: Math.round(h * PLATE), h } : { x: 0, y: 0, w, h: Math.round(w / PLATE) };
  src.x = Math.floor((w - src.w) / 2);
  src.y = Math.floor((h - src.h) / 2);
  const outW = Math.min(BANNER_WIDTH, src.w);
  return { src, out: { w: outW, h: Math.round(outW / PLATE) } };
}

/** Stores a PNG as the gallery's logo or plate banner and returns its path. */
export async function uploadBranding(client: Client, galleryId: string, kind: 'logo' | 'banner', png: Uint8Array): Promise<string> {
  const path = `${galleryId}/${kind}.png`;
  const { error } = await client.storage.from('branding').upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  await updateGallery(client, galleryId, kind === 'logo' ? { logo_path: path } : { banner_path: path });
  return path;
}
