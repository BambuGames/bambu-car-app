// Share (spec 6.3): poster, optional studio photos and the listing text go to the system share sheet in one
// step. The text is copied to the clipboard as well; a second button copies it for mobile.de.
import { Skia, type SkImage } from '@shopify/react-native-skia';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';

import { LANGUAGES, type Language } from '../../../../domain/vehicleData';
import type { Vehicle } from '../../../../domain/vehicle';
import { signedUrl, toCache } from '../../../../export/device';
import { exportItems, type ExportVersion } from '../../../../export/plan';
import { fetchGallerySettings, type GalleryBranding } from '../../../../gallery/branding';
import i18n from '../../../../lib/i18n';
import { isStale } from '../../../../listing/stale';
import { supabase } from '../../../../lib/supabase';
import { useSession } from '../../../../lib/session';
import { getListing, getListingTexts, type Listing, type ListingText } from '../../../../local/listings';
import { getVehicle } from '../../../../local/vehicles';
import { PosterPreview } from '../../../../share/PosterPreview';
import { posterModel, type PosterFormat } from '../../../../share/posterModel';
import { loadPosterFonts, renderPoster, writePoster } from '../../../../share/renderPoster';
import { isShareCancel, plateWarning, shareMessage, shareReadiness } from '../../../../share/shareSet';
import { StudioLoadState } from '../../../../studio/LoadState';
import { coverPhoto } from '../../../../studio/order';
import { studioApi, useStudio } from '../../../../studio/useStudio';
import { useSync } from '../../../../sync/SyncProvider';
import { Button } from '../../../../ui/Button';
import { Notice } from '../../../../ui/Notice';
import { Segmented } from '../../../../ui/Segmented';
import { colors, fontSize, radius, space } from '../../../../ui/theme';

const LANGUAGE_NAMES: Record<Language, string> = { de: 'Deutsch', tr: 'Türkçe', en: 'English' };
const FORMATS: PosterFormat[] = ['4:5', '9:16'];
const VERSIONS: Extract<ExportVersion, 'watermarked' | 'plain'>[] = ['watermarked', 'plain']; // never the originals
type Loaded = { vehicle: Vehicle; listing: Listing | null; texts: Partial<Record<Language, ListingText>>; gallery: GalleryBranding };
type Poster = { uri: string; version: number };

async function decode(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  data.dispose();
  if (!image) throw new Error('poster_image');
  return image;
}

export default function ShareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, membership } = useSession();
  const { online } = useSync();
  const { data, error, refresh } = useStudio(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [language, setLanguage] = useState<Language>('de');
  const [version, setVersion] = useState<(typeof VERSIONS)[number]>('watermarked');
  const [format, setFormat] = useState<PosterFormat>('4:5');
  const [chosenPhoto, setChosenPhoto] = useState<string | null>(null); // null: the cover
  const [extras, setExtras] = useState<ReadonlySet<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [poster, setPoster] = useState<Poster | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve()); // poster jobs one after another: they share files
  const posterCount = useRef(0);

  const galleryId = membership?.galleryId;
  // On every focus, so the text written on the listing screen is here when the user comes back.
  const load = useCallback(() => {
    if (!db || !id || !galleryId) return;
    let active = true;
    Promise.all([getVehicle(db, id), getListing(db, id), getListingTexts(db, id), fetchGallerySettings(supabase, galleryId)])
      .then(([vehicle, listing, list, settings]) => {
        if (!active) return;
        if (vehicle) {
          setLoadFailed(false);
          setLoaded({ vehicle, listing, texts: Object.fromEntries(list.map((x) => [x.language, x])), gallery: settings.gallery });
        } else setLoadFailed(true);
      })
      .catch(() => active && setLoadFailed(true));
    return () => {
      active = false;
    };
  }, [db, id, galleryId]);
  useFocusEffect(load);

  // Back online after a failed load: try again without a tap.
  useEffect(() => {
    if (online && loadFailed) {
      load();
      refresh();
    }
  }, [online, loadFailed, load, refresh]);

  // Processed photos (the chosen version) in listing order; the poster photo is the cover unless chosen.
  const items = data ? exportItems(data.photos, version) : [];
  const coverId = data ? coverPhoto(data.photos)?.id : undefined;
  const posterItem = items.find((i) => i.photoId === (chosenPhoto ?? coverId)) ?? items[0] ?? null;
  const posterPhotoId = posterItem?.photoId ?? null;
  const posterPath = posterItem?.path ?? null;
  const itemPaths = items.map((i) => i.path).join('|');

  useEffect(() => {
    const paths = itemPaths ? itemPaths.split('|') : [];
    let active = true;
    studioApi
      .signedUrls('processed', paths)
      .then((urls) => active && setThumbs(urls))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [itemPaths]);

  // Draws the poster again whenever one of its inputs changes. The photo comes down from the cache of the
  // signed URL; the preview and the share sheet use the file this writes.
  useEffect(() => {
    if (!loaded || !online || !posterPath || !posterPhotoId) return;
    let active = true;
    setPoster(null);
    setPosterFailed(false);
    chain.current = chain.current.then(async () => {
      if (!active) return;
      let photo: SkImage | null = null;
      let logo: SkImage | null = null;
      try {
        const { vehicle, listing, gallery } = loaded;
        const [fonts, photoUri, logoUri] = await Promise.all([
          loadPosterFonts(),
          toCache(await signedUrl('processed', posterPath), `poster_src_${posterPhotoId}_${version}.jpg`),
          gallery.logo_path
            ? studioApi
                .signedUrls('branding', [gallery.logo_path])
                .then((urls) => toCache(urls[gallery.logo_path!], `poster_logo_${vehicle.galleryId}.png`))
                .catch(() => null)
            : null,
        ]);
        photo = await decode(photoUri);
        logo = logoUri ? await decode(logoUri).catch(() => null) : null;
        const model = posterModel(vehicle, listing, gallery, language, i18n.getFixedT(language));
        const uri = await writePoster(renderPoster({ photo, logo, model, format, fonts }), vehicle.id, format);
        if (active) setPoster({ uri, version: ++posterCount.current });
      } catch {
        if (active) setPosterFailed(true);
      } finally {
        photo?.dispose();
        logo?.dispose();
      }
    });
    return () => {
      active = false;
    };
  }, [loaded, online, posterPath, posterPhotoId, version, language, format]);

  if (!data || !loaded) {
    return (
      <StudioLoadState
        error={loadFailed ? 'load' : error}
        online={online}
        onRetry={async () => {
          load();
          await refresh();
        }}
      />
    );
  }

  const { vehicle, listing, gallery } = loaded;
  const text = loaded.texts[language] ?? null;
  const readiness = shareReadiness({ online, hasProcessedPhoto: items.length > 0 });
  const ready = readiness === 'ok' && !busy;
  const message = () => shareMessage(text, posterModel(vehicle, listing, gallery, language, i18n.getFixedT(language)));
  const title = `${vehicle.make} ${vehicle.model}`;
  const others = items.filter((i) => i.photoId !== posterPhotoId);
  const stale = text ? isStale(text, vehicle.factsUpdatedAt, listing?.factsUpdatedAt ?? null) : false;
  const sent = new Set([posterPhotoId, ...extras]);
  const warning = items.length === 0 ? null : plateWarning(!!gallery.banner_path, data.photos.filter((p) => sent.has(p.id)));
  const openListing = () => router.push({ pathname: '/vehicles/[id]/listing', params: { id: vehicle.id } });

  const toggle = (photoId: string) => {
    const next = new Set(extras);
    if (!next.delete(photoId)) next.add(photoId);
    setExtras(next);
  };

  const copyText = async () => {
    setNote(null);
    await Clipboard.setStringAsync(message());
    setNote({ kind: 'info', text: t('share.copied') });
  };

  const send = async () => {
    if (!poster) return;
    setNote(null);
    setBusy(true);
    try {
      const body = message();
      const picked = others.filter((i) => extras.has(i.photoId));
      const files = await Promise.all(picked.map(async (i) => toCache(await signedUrl(i.bucket, i.path), `share_${vehicle.id}_${version}_${i.name}`)));
      await Clipboard.setStringAsync(body); // some apps drop the message: it is on the clipboard to paste
      try {
        await Share.open({ urls: [poster.uri, ...files], message: body, failOnCancel: true });
      } catch (e) {
        if (!isShareCancel(e)) throw e;
      }
      setNote({ kind: 'info', text: t('share.copied') });
    } catch {
      setNote({ kind: 'error', text: t('share.shareFailed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Segmented
        label={t('share.language')}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
        value={language}
        onChange={setLanguage}
      />
      <Segmented
        label={t('export.version')}
        options={VERSIONS.map((v) => ({ value: v, label: t(`export.versions.${v}`) }))}
        value={version}
        onChange={setVersion}
      />
      <Segmented label={t('share.size')} options={FORMATS.map((f) => ({ value: f, label: f }))} value={format} onChange={setFormat} />

      <View style={styles.preview}>
        <PosterPreview key={poster?.version} uri={poster?.uri ?? null} format={format} label={t('share.posterLabel', { title })} />
      </View>
      {poster || posterFailed || !online || items.length === 0 ? null : <Notice text={t('share.preparing')} />}
      {posterFailed ? <Notice kind="error" text={t('share.failed')} /> : null}
      {warning ? (
        <>
          <Notice kind="error" text={t(warning === 'check' ? 'share.plateCheck' : 'share.plateNoBanner')} />
          <Button
            variant="secondary"
            label={t(warning === 'check' ? 'share.plateCheckAction' : 'share.bannerAction')}
            onPress={() => router.push(warning === 'check' ? { pathname: '/vehicles/[id]/plates', params: { id: vehicle.id } } : '/gallery/settings')}
          />
        </>
      ) : null}

      {items.length > 0 ? (
        <>
          <Text style={styles.label}>{t('share.photo')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} accessibilityRole="radiogroup">
            {items.map((i) => (
              <Pressable
                key={i.photoId}
                accessibilityRole="radio"
                accessibilityLabel={i.name}
                accessibilityState={{ checked: i.photoId === posterPhotoId }}
                onPress={() => setChosenPhoto(i.photoId)}
                style={[styles.thumbBox, i.photoId === posterPhotoId && styles.thumbOn]}
              >
                <Image source={thumbs[i.path] ? { uri: thumbs[i.path], cacheKey: i.path } : undefined} style={styles.thumb} contentFit="cover" accessible={false} />
              </Pressable>
            ))}
          </ScrollView>
          {others.length > 0 ? (
            <>
              <Text style={styles.label}>{t('share.more')}</Text>
              <View style={styles.grid}>
                {others.map((i) => {
                  const on = extras.has(i.photoId);
                  return (
                    <Pressable
                      key={i.photoId}
                      accessibilityRole="checkbox"
                      accessibilityLabel={i.name}
                      accessibilityState={{ checked: on }}
                      onPress={() => toggle(i.photoId)}
                      style={styles.tile}
                    >
                      <Image source={thumbs[i.path] ? { uri: thumbs[i.path], cacheKey: i.path } : undefined} style={[styles.tileImage, !on && styles.tileOff]} contentFit="cover" accessible={false} />
                      <View style={[styles.check, on && styles.checkOn]} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      ) : (
        <Notice text={t('share.noPhotos')} />
      )}

      {stale ? <Notice text={t('listing.stale')} /> : null}
      {!text || stale ? (
        <Pressable accessibilityRole="link" onPress={openListing} hitSlop={space[2]}>
          <Text style={styles.link}>{t(text ? 'listing.recreate' : 'share.noText')}</Text>
        </Pressable>
      ) : null}

      <Button label={t('share.send')} onPress={send} loading={busy} disabled={!ready || !poster} />
      <Button variant="secondary" label={t('share.copyText')} onPress={copyText} disabled={!ready} />
      {readiness === 'offline' ? <Notice text={t('common.offline')} /> : null}
      {note ? <Notice kind={note.kind} text={note.text} /> : null}
    </ScrollView>
  );
}

const CHECK = 22;
const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  preview: { alignItems: 'center' },
  label: { fontSize: fontSize.small, fontWeight: '500', color: colors.text },
  link: { fontSize: fontSize.body, fontWeight: '600', color: colors.text, textDecorationLine: 'underline' },
  strip: { gap: space[1] },
  thumbBox: { padding: 2, borderRadius: radius, borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.accent },
  thumb: { width: 88, aspectRatio: 4 / 3, borderRadius: radius - 2, backgroundColor: colors.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  tile: { width: '31%' },
  tileImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.surface },
  tileOff: { opacity: 0.35 },
  check: {
    position: 'absolute', top: space[1], right: space[1], width: CHECK, height: CHECK, borderRadius: CHECK / 2,
    borderWidth: 2, borderColor: colors.background, backgroundColor: 'rgba(0,0,0,0.25)',
  },
  checkOn: { backgroundColor: colors.text },
});
