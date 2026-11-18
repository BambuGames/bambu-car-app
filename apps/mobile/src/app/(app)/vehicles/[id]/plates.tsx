// Plate quick check (design 7.4, M0 decision): every placed banner and every plate not found, one by one.
// "Passt" confirms; adjusting the corners or "no plate" re-renders that photo (no credit, no Photoroom).
import * as Network from 'expo-network';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { defaultPlateQuad, originalToOutput, outputToOriginal, type Point } from '../../../../studio/geometry';
import { plateQueue } from '../../../../studio/order';
import { PlateEditor } from '../../../../studio/PlateEditor';
import { StudioLoadState } from '../../../../studio/LoadState';
import { studioApi, useStudio } from '../../../../studio/useStudio';
import { Button } from '../../../../ui/Button';
import { Notice } from '../../../../ui/Notice';
import { colors, fontSize, radius, space } from '../../../../ui/theme';

export default function PlatesScreen() {
  const { t } = useTranslation();
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId?: string }>();
  const { data, error, refresh } = useStudio(id);
  const network = Network.useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const [editing, setEditing] = useState<Point[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [image, setImage] = useState<{ url: string; path: string } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [retry, setRetry] = useState<string | null>(null);

  // One photo when opened from the photo screen, else the queue in listing order.
  const queue = plateQueue(data?.photos ?? [], { photoId, done, retry });
  const photo = queue[0] ?? null;
  const outputPath = photo?.output_path ?? null;

  useEffect(() => {
    if (!outputPath) return;
    let active = true;
    studioApi
      .signedUrls('processed', [outputPath])
      .then((urls) => active && setImage(urls[outputPath] ? { url: urls[outputPath], path: outputPath } : null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [outputPath]);

  if (!data) return <StudioLoadState error={error} online={online} onRetry={refresh} />;
  if (!photo) {
    return (
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Notice text={t('plates.allChecked')} />
        <Button label={t('plates.back')} onPress={() => router.back()} />
      </ScrollView>
    );
  }

  const corners: Point[] | null = photo.plate_corners?.map(([x, y]) => ({ x, y })) ?? null;
  const placement = photo.placement;

  const finish = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      if (photoId) {
        router.back(); // single-photo mode: back to the photo it was opened from
        return;
      }
      setRetry(null);
      setDone((d) => [...d, photo.id]);
      setEditing(null);
      refresh();
    } catch {
      setFailed(true);
      setRetry(photo.id); // keep it on screen: its fix may be saved without a new render
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => finish(() => studioApi.savePlate(photo.id, corners, 'confirmed'));
  const noPlate = () =>
    finish(async () => {
      await studioApi.savePlate(photo.id, null, 'none');
      await studioApi.renderPhoto(id, photo.id);
    });
  const startEditing = () =>
    setEditing(corners && placement ? corners.map((c) => originalToOutput(placement, c)) : defaultPlateQuad());
  const saveCorners = () =>
    finish(async () => {
      if (!editing || !placement) return;
      await studioApi.savePlate(photo.id, editing.map((p) => outputToOriginal(placement, p)), 'confirmed');
      await studioApi.renderPhoto(id, photo.id);
    });

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" scrollEnabled={!editing}>
      {/* iOS 26 takes any drag to the right as "back"; it must not while a corner is dragged. */}
      <Stack.Screen options={{ title: t(`slots.${photo.slot}`), gestureEnabled: !editing }} />
      {!photoId ? <Text style={styles.count}>{t('plates.remaining', { count: queue.length })}</Text> : null}
      {editing ? (
        <>
          <PlateEditor image={image} quad={editing} onChange={setEditing} zoom={!!photo.plate_corners} />
          <Text style={styles.hint}>{t('plates.dragHint')}</Text>
          <Button label={t('plates.save')} onPress={saveCorners} loading={busy} />
          <Button variant="secondary" label={t('plates.cancel')} onPress={() => setEditing(null)} disabled={busy} />
        </>
      ) : (
        <>
          <Image source={image ? { uri: image.url, cacheKey: image.path } : undefined} style={styles.image} contentFit="contain" />
          <Text style={styles.hint}>{t(photo.plate_status === 'needs_check' ? 'plates.notFound' : 'plates.question')}</Text>
          {photo.plate_status === 'auto' ? <Button label={t('plates.ok')} onPress={confirm} loading={busy} /> : null}
          <Button
            variant={photo.plate_status === 'auto' ? 'secondary' : 'primary'}
            label={t(corners ? 'plates.adjust' : 'plates.place')}
            onPress={startEditing}
            disabled={busy || !placement}
          />
          <Button variant="secondary" label={t('plates.none')} onPress={noPlate} disabled={busy} />
        </>
      )}
      {failed ? <Notice kind="error" text={t('studio.errors.internal')} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  count: { fontSize: fontSize.small, color: colors.textMuted },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.surface },
  hint: { fontSize: fontSize.body, color: colors.text },
});
