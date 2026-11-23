// Gallery settings (design 7.2.9, 9): logo, plate banner, watermark and the default studio. Owner only,
// online only. Every change is saved at once and applies to the next processing.
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchGallerySettings, saveWatermark, setDefaultBackground, uploadBranding, type GalleryBranding } from '../../../gallery/branding';
import { normalizePhone, saveContact } from '../../../gallery/contact';
import { pickBrandingImage } from '../../../gallery/pickImage';
import { WatermarkPreview } from '../../../gallery/WatermarkPreview';
import type { WatermarkPosition, WatermarkSettings } from '../../../gallery/watermarkLayout';
import { useSession } from '../../../lib/session';
import { supabase } from '../../../lib/supabase';
import type { Background } from '../../../studio/api';
import { BackgroundSwatch } from '../../../studio/BackgroundSwatch';
import { studioApi } from '../../../studio/useStudio';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/Notice';
import { Segmented } from '../../../ui/Segmented';
import { TextField } from '../../../ui/TextField';
import { colors, fontSize, radius, space } from '../../../ui/theme';

const SIZES = { small: 0.12, medium: 0.18, large: 0.26 } as const;
const OPACITIES = [0.5, 0.75, 1] as const;
const BAND_COLORS = { black: colors.ink, grey: colors.ink2, white: colors.paper, blue: colors.action, red: colors.mark, green: colors.ready } as const;
const POSITIONS: { value: WatermarkPosition; left: `${number}%`; top: `${number}%` }[] = [
  { value: 'top_left', left: '0%', top: '0%' },
  { value: 'top_right', left: '100%', top: '0%' },
  { value: 'center', left: '50%', top: '50%' },
  { value: 'bottom_left', left: '0%', top: '100%' },
  { value: 'bottom_right', left: '100%', top: '100%' },
];

const nearest = <T extends number>(options: readonly T[], v: number): T =>
  options.reduce((best, o) => (Math.abs(o - v) < Math.abs(best - v) ? o : best), options[0]);

type ContactKey = 'phone' | 'whatsapp';

// One number: saved when the field loses focus and the normalized value changed; an invalid one only shows the error.
function ContactField({ field, saved, editable, onSave }: { field: ContactKey; saved: string | null; editable: boolean; onSave: (value: string | null) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [text, setText] = useState(saved ?? '');
  const [invalid, setInvalid] = useState(false);
  const [result, setResult] = useState<'saved' | 'failed' | null>(null);
  const commit = async () => {
    const n = normalizePhone(text);
    setInvalid(n === 'invalid');
    if (n === 'invalid' || n === saved) return;
    setResult((await onSave(n)) ? 'saved' : 'failed');
  };
  return (
    <View style={styles.field}>
      <TextField
        label={t(`gallerySettings.${field}`)}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setResult(null);
        }}
        onBlur={commit}
        editable={editable}
        keyboardType="phone-pad"
        error={invalid ? t('gallerySettings.phoneInvalid') : null}
      />
      {result ? <Notice kind={result === 'failed' ? 'error' : 'info'} text={t(result === 'failed' ? 'gallerySettings.saveFailed' : 'gallerySettings.contactSaved')} /> : null}
    </View>
  );
}

type Loaded = { gallery: GalleryBranding; backgrounds: Background[]; photoUrl: string | null; logo: { url: string; aspect: number } | null; bannerUrl: string | null };

export default function GallerySettingsScreen() {
  const { t } = useTranslation();
  const { membership } = useSession();
  const galleryId = membership?.galleryId;
  const isOwner = membership?.role === 'owner';
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<'logo' | 'banner' | null>(null);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!galleryId) return;
    let active = true;
    setFailed(false);
    (async () => {
      const { gallery, backgrounds, latestOutput } = await fetchGallerySettings(supabase, galleryId);
      const [branding, processed] = await Promise.all([
        studioApi.signedUrls('branding', [gallery.logo_path, gallery.banner_path].filter((p): p is string => !!p)),
        studioApi.signedUrls('processed', latestOutput ? [latestOutput] : []),
      ]);
      const logoUrl = gallery.logo_path ? branding[gallery.logo_path] : undefined;
      const size = logoUrl ? await RNImage.getSize(logoUrl).catch(() => null) : null;
      if (!active) return;
      setData({
        gallery,
        backgrounds,
        photoUrl: latestOutput ? (processed[latestOutput] ?? null) : null,
        logo: logoUrl && size ? { url: logoUrl, aspect: size.width / size.height } : null,
        bannerUrl: gallery.banner_path ? (branding[gallery.banner_path] ?? null) : null,
      });
    })().catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [galleryId]);
  useFocusEffect(load);

  if (!data || !galleryId) {
    return (
      <View style={styles.content}>
        {failed ? (
          <>
            <Notice kind="error" text={t('common.offline')} />
            <Button label={t('common.retry')} onPress={load} />
          </>
        ) : null}
      </View>
    );
  }

  const { gallery } = data;
  const watermark = gallery.watermark;

  const done = () => {
    setChanged(true);
    setError(null);
  };
  const failedSave = () => {
    setError(t('gallerySettings.saveFailed'));
    load();
  };

  const pick = async (kind: 'logo' | 'banner') => {
    setBusy(kind);
    try {
      const picked = await pickBrandingImage(kind);
      if (picked) {
        await uploadBranding(supabase, galleryId, kind, picked.png);
        done();
        load();
      }
    } catch {
      setError(t('gallerySettings.uploadFailed'));
    } finally {
      setBusy(null);
    }
  };

  const updateWatermark = (patch: Partial<WatermarkSettings>) => {
    const next = { ...watermark, ...patch };
    setData({ ...data, gallery: { ...gallery, watermark: next } });
    saveWatermark(supabase, galleryId, next).then(done, failedSave);
  };

  const chooseBackground = (id: string) => {
    setData({ ...data, gallery: { ...gallery, default_background_id: id } });
    setDefaultBackground(supabase, galleryId, id).then(done, failedSave);
  };

  // Only the changed field goes out, so two quick blurs cannot overwrite each other. The result shows at the field.
  const saveContactField = (field: ContactKey) => async (value: string | null): Promise<boolean> => {
    try {
      if (await saveContact(supabase, galleryId, { [field]: value })) return false;
      setData((d) => d && { ...d, gallery: { ...d.gallery, [field]: value } });
      return true;
    } catch {
      return false;
    }
  };

  const selectedBackground = gallery.default_background_id ?? data.backgrounds[0]?.id;
  const band = watermark.band;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {changed ? <Notice text={t('gallerySettings.applies')} /> : null}
      {error ? <Notice kind="error" text={error} /> : null}

      <Text style={styles.heading} accessibilityRole="header">
        {t('gallerySettings.watermark')}
      </Text>
      <WatermarkPreview photoUrl={data.photoUrl} logo={data.logo} settings={watermark} />
      {!data.logo ? <Text style={styles.hint}>{t('gallerySettings.noLogo')}</Text> : null}
      <Button
        variant="secondary"
        label={t(data.logo ? 'gallerySettings.logoReplace' : 'gallerySettings.logoPick')}
        onPress={() => pick('logo')}
        loading={busy === 'logo'}
        disabled={busy !== null}
      />
      <Text style={styles.hint}>{t('gallerySettings.logoHint')}</Text>

      <Text style={styles.label}>{t('gallerySettings.position')}</Text>
      <View style={styles.positions} accessibilityRole="radiogroup" accessibilityLabel={t('gallerySettings.position')}>
        {POSITIONS.map((p) => (
          <Pressable
            key={p.value}
            accessibilityRole="radio"
            accessibilityLabel={t(`gallerySettings.positions.${p.value}`)}
            accessibilityState={{ selected: watermark.position === p.value }}
            onPress={() => updateWatermark({ position: p.value })}
            style={[styles.positionTarget, { left: p.left, top: p.top }]}
          >
            <View style={[styles.positionMark, watermark.position === p.value && styles.positionSelected]} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{t(`gallerySettings.positions.${watermark.position}`)}</Text>

      <Text style={styles.label}>{t('gallerySettings.size')}</Text>
      <Segmented
        label={t('gallerySettings.size')}
        value={(Object.keys(SIZES) as (keyof typeof SIZES)[]).find((k) => SIZES[k] === nearest(Object.values(SIZES), watermark.width)) ?? 'medium'}
        onChange={(k) => updateWatermark({ width: SIZES[k] })}
        options={(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => ({ value: k, label: t(`gallerySettings.${k}`) }))}
      />

      <Text style={styles.label}>{t('gallerySettings.opacity')}</Text>
      <Segmented
        label={t('gallerySettings.opacity')}
        value={String(nearest(OPACITIES, watermark.opacity))}
        onChange={(v) => updateWatermark({ opacity: Number(v) })}
        options={OPACITIES.map((o) => ({ value: String(o), label: t('gallerySettings.percent', { value: o * 100 }) }))}
      />

      <Text style={styles.label}>{t('gallerySettings.band')}</Text>
      <Segmented
        label={t('gallerySettings.band')}
        value={band ? band.edge : 'none'}
        onChange={(v) => updateWatermark({ band: v === 'none' ? null : { color: band?.color ?? colors.ink, edge: v } })}
        options={[
          { value: 'none', label: t('gallerySettings.bandNone') },
          { value: 'top', label: t('gallerySettings.bandTop') },
          { value: 'bottom', label: t('gallerySettings.bandBottom') },
        ]}
      />
      {band ? (
        <View style={styles.colors} accessibilityRole="radiogroup" accessibilityLabel={t('gallerySettings.bandColor')}>
          {(Object.keys(BAND_COLORS) as (keyof typeof BAND_COLORS)[]).map((name) => {
            const selected = band.color.toUpperCase() === BAND_COLORS[name].toUpperCase();
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={t(`gallerySettings.colors.${name}`)}
                accessibilityState={{ selected }}
                onPress={() => updateWatermark({ band: { ...band, color: BAND_COLORS[name] } })}
                style={[styles.colorRing, selected && styles.colorSelected]}
              >
                <View style={[styles.color, { backgroundColor: BAND_COLORS[name] }]} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.heading} accessibilityRole="header">
        {t('gallerySettings.banner')}
      </Text>
      {data.bannerUrl ? <Image source={{ uri: data.bannerUrl }} style={styles.banner} contentFit="contain" accessible={false} /> : null}
      <Button
        variant="secondary"
        label={t(data.bannerUrl ? 'gallerySettings.bannerReplace' : 'gallerySettings.bannerPick')}
        onPress={() => pick('banner')}
        loading={busy === 'banner'}
        disabled={busy !== null}
      />
      <Text style={styles.hint}>{t('gallerySettings.bannerHint')}</Text>

      <Text style={styles.heading} accessibilityRole="header">
        {t('gallerySettings.background')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches} accessibilityRole="radiogroup">
        {data.backgrounds.map((b) => (
          <BackgroundSwatch key={b.id} spec={b.spec} name={b.name} selected={b.id === selectedBackground} onPress={() => chooseBackground(b.id)} />
        ))}
      </ScrollView>
      <Text style={styles.hint}>{t('gallerySettings.backgroundHint')}</Text>

      <Text style={styles.heading} accessibilityRole="header">
        {t('gallerySettings.contact')}
      </Text>
      <ContactField field="phone" saved={gallery.phone} editable={isOwner} onSave={saveContactField('phone')} />
      <ContactField field="whatsapp" saved={gallery.whatsapp} editable={isOwner} onSave={saveContactField('whatsapp')} />
      <Text style={styles.hint}>{t(isOwner ? 'gallerySettings.contactHint' : 'gallerySettings.contactOwnerOnly')}</Text>
    </ScrollView>
  );
}

const MARK = 44;
const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.paper },
  field: { gap: space[1] },
  heading: { fontSize: fontSize.body, fontWeight: '600', color: colors.ink, marginTop: space[3] },
  label: { fontSize: fontSize.small, color: colors.ink2, marginTop: space[1] },
  hint: { fontSize: fontSize.small, color: colors.ink2 },
  // A small picture of the photo: tap where the logo should go.
  positions: { width: 176, aspectRatio: 4 / 3, margin: MARK / 2, borderWidth: 1, borderColor: colors.rule, borderRadius: radius },
  positionTarget: { position: 'absolute', width: MARK, height: MARK, marginLeft: -MARK / 2, marginTop: -MARK / 2, alignItems: 'center', justifyContent: 'center' },
  positionMark: { width: 20, height: 14, borderRadius: 3, borderWidth: 2, borderColor: colors.ink2, backgroundColor: colors.paper },
  positionSelected: { borderColor: colors.action, backgroundColor: colors.action },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  colorRing: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: colors.ink },
  color: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  banner: { width: '100%', aspectRatio: 520 / 110, borderRadius: radius, backgroundColor: colors.sheet },
  swatches: { gap: space[2] },
});
