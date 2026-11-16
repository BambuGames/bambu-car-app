// Studio (design 5.6, 7.5): background and tone, "Bearbeiten" (the first run uses one credit), live
// progress, and retry for failed or stuck photos. Online only; results and fixes follow in the same screen.
import { Image } from 'expo-image';
import * as Network from 'expo-network';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { canManageGallery } from '../../../../lib/roles';
import { useSession } from '../../../../lib/session';
import { listPhotos } from '../../../../local/photos';
import type { ProcessError } from '../../../../studio/api';
import { BackgroundSwatch } from '../../../../studio/BackgroundSwatch';
import { StudioLoadState } from '../../../../studio/LoadState';
import { coverPhoto, orderPhotos } from '../../../../studio/order';
import { isStuck, processBlocker, summarize, type StudioPhoto } from '../../../../studio/status';
import { studioApi, useStudio } from '../../../../studio/useStudio';
import { useSync } from '../../../../sync/SyncProvider';
import { Button } from '../../../../ui/Button';
import { Notice } from '../../../../ui/Notice';
import { colors, fontSize, radius, space } from '../../../../ui/theme';

const NOT_RECOGNISED = new Set(['empty_mask', 'car_too_small']);

export default function StudioScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, membership } = useSession();
  const { subscribe } = useSync();
  const { data, error, refresh, now } = useStudio(id);
  const network = Network.useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const [pendingUploads, setPendingUploads] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ProcessError | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Thumbnails of the processed photos; the image cache is keyed by path, so new signed URLs do not reload.
  useEffect(() => {
    const paths = (data?.photos ?? []).map((p) => p.output_path).filter((p): p is string => !!p);
    let active = true;
    studioApi
      .signedUrls('processed', paths)
      .then((urls) => active && setThumbs(urls))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [data]);

  // Photos still on this phone: processing now would leave them out.
  useFocusEffect(
    useCallback(() => {
      if (!db || !id) return;
      let active = true;
      const load = () =>
        listPhotos(db, id).then((rows) => {
          if (active) setPendingUploads(rows.filter((r) => ['pending', 'uploading', 'failed'].includes(r.uploadState)).length);
        });
      load();
      const unsubscribe = subscribe(load);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [db, id, subscribe]),
  );

  const start = async (body: { photoId?: string; rerender?: boolean }) => {
    setBusy(true);
    setMessage(null);
    const result = await studioApi.startProcessing({ vehicleId: id, ...body });
    setBusy(false);
    if ('error' in result) setMessage(result.error);
    else refresh();
  };

  const setOptions = async (options: { backgroundId?: string; toneEnabled?: boolean }) => {
    setOptionsFailed(false);
    try {
      await studioApi.setStudioOptions(id, options);
    } catch {
      setOptionsFailed(true);
    }
    refresh();
  };

  if (!data) return <StudioLoadState error={error} online={online} onRetry={refresh} />;

  const photos = orderPhotos(data.photos);
  const summary = summarize(photos, now);
  const blocker = processBlocker({ online, pendingUploads, photos, now });
  const cover = coverPhoto(photos);
  const selected = data.vehicle.background_id ?? data.vehicle.gallery?.default_background_id ?? data.backgrounds[0]?.id;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('studio.background')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches} accessibilityRole="radiogroup">
        {data.backgrounds.map((b) => (
          <BackgroundSwatch
            key={b.id}
            spec={b.spec}
            name={b.name}
            selected={b.id === selected}
            disabled={!online}
            onPress={() => setOptions({ backgroundId: b.id })}
          />
        ))}
      </ScrollView>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>{t('studio.tone')}</Text>
          <Text style={styles.hint}>{t('studio.toneHint')}</Text>
        </View>
        <Switch
          value={data.vehicle.tone_enabled}
          onValueChange={(toneEnabled) => setOptions({ toneEnabled })}
          disabled={!online}
          accessibilityLabel={t('studio.tone')}
        />
      </View>
      {optionsFailed ? <Notice kind="error" text={t('studio.optionsFailed')} /> : null}

      <Button label={t('studio.process')} onPress={() => start({})} disabled={blocker !== null} loading={busy} />
      {blocker && blocker !== 'checking' ? <Notice text={t(`studio.blocked.${blocker}`, { count: pendingUploads ?? 0 })} /> : null}
      {!blocker && !data.vehicle.credit_charged_at ? <Notice text={t('studio.firstCharge')} /> : null}
      {message ? (
        <Notice
          kind="error"
          text={t(message === 'no_credit' && canManageGallery(membership) ? 'studio.errors.no_credit_owner' : `studio.errors.${message}`)}
        />
      ) : null}
      {summary.done > 0 ? (
        <View style={styles.rerender}>
          <Button variant="secondary" label={t('studio.rerender')} onPress={() => start({ rerender: true })} disabled={!online || busy} />
          <Text style={styles.hint}>{t('studio.rerenderHint')}</Text>
        </View>
      ) : null}

      {summary.plateChecks > 0 ? (
        <Button
          label={t('plates.open', { count: summary.plateChecks })}
          onPress={() => router.push({ pathname: '/vehicles/[id]/plates', params: { id } })}
        />
      ) : null}
      {summary.done > 0 ? (
        <Button variant="secondary" label={t('export.title')} onPress={() => router.push({ pathname: '/vehicles/[id]/export', params: { id } })} />
      ) : null}
      {summary.total > 0 ? (
        <Text style={styles.heading} accessibilityRole="header">
          {t('studio.progress', { done: summary.done, total: summary.total })}
        </Text>
      ) : null}
      <View style={styles.grid}>
        {photos.map((p) => (
          <Tile
            key={p.id}
            vehicleId={id}
            photo={p}
            thumb={p.output_path ? thumbs[p.output_path] : undefined}
            isCover={p.id === cover?.id}
            reshot={p.process_status === 'unprocessed' && !!data.vehicle.credit_charged_at}
            now={now}
            onRetry={() => start({ photoId: p.id })}
            retryDisabled={!online || busy}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function Tile(props: {
  vehicleId: string;
  photo: StudioPhoto;
  thumb: string | undefined;
  isCover: boolean;
  reshot: boolean;
  now: number;
  onRetry: () => void;
  retryDisabled: boolean;
}) {
  const { t } = useTranslation();
  const { photo } = props;
  const stuck = isStuck(photo, props.now);
  const failed = photo.process_status === 'failed' || stuck;
  const plateCheck = photo.process_status === 'done' && (photo.plate_status === 'auto' || photo.plate_status === 'needs_check');
  let status = t(`studio.status.${stuck ? 'stuck' : photo.process_status}`);
  if (props.reshot) status = t('studio.reshot');
  if (photo.process_status === 'failed') {
    status += ` · ${t(NOT_RECOGNISED.has(photo.process_error ?? '') ? 'studio.photoError.notFound' : 'studio.photoError.generic')}`;
  }
  return (
    <View style={styles.tile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`slots.${photo.slot}`)}
        onPress={() => router.push({ pathname: '/vehicles/[id]/photo/[photoId]', params: { id: props.vehicleId, photoId: photo.id } })}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Image
          source={props.thumb && photo.output_path ? { uri: props.thumb, cacheKey: photo.output_path } : undefined}
          style={styles.thumb}
          contentFit="cover"
          accessible={false}
        />
        <Text style={styles.label} numberOfLines={1}>
          {t(`slots.${photo.slot}`)}
        </Text>
        <Text style={[styles.hint, failed && styles.error]} numberOfLines={2}>
          {status}
        </Text>
        {props.isCover ? <Text style={styles.tag}>{t('studio.cover')}</Text> : null}
        {plateCheck ? <Text style={[styles.tag, styles.pendingTag]}>{t('studio.plateCheck')}</Text> : null}
      </Pressable>
      {failed ? <Button variant="secondary" label={t('studio.retry')} onPress={props.onRetry} disabled={props.retryDisabled} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  heading: { fontSize: fontSize.body, fontWeight: '600', color: colors.text, marginTop: space[2] },
  swatches: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, gap: space[0] },
  label: { fontSize: fontSize.body, color: colors.text },
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  error: { color: colors.danger },
  rerender: { gap: space[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { width: '47%', gap: space[1] },
  thumb: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.surface, marginBottom: space[1] },
  tag: { fontSize: fontSize.small, fontWeight: '600', color: colors.text },
  pendingTag: { color: colors.pending },
  pressed: { opacity: 0.7 },
});
