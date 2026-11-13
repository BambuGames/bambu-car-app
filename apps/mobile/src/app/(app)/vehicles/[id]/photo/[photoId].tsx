// One processed photo (design 5.6): before/after, retake, retry; plate and touch-up fixes start here.
import * as Network from 'expo-network';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { CompareImage, type Picture } from '../../../../../studio/CompareImage';
import { isStuck, originalKey } from '../../../../../studio/status';
import { studioApi, useStudio } from '../../../../../studio/useStudio';
import { Button } from '../../../../../ui/Button';
import { Notice } from '../../../../../ui/Notice';
import { colors, fontSize, space } from '../../../../../ui/theme';

export default function PhotoScreen() {
  const { t } = useTranslation();
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const { data, refresh, now } = useStudio(id);
  const network = Network.useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const photo = data?.photos.find((p) => p.id === photoId) ?? null;
  const [pictures, setPictures] = useState<{ before: Picture | null; after: Picture | null }>({ before: null, after: null });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!photo) return;
    let active = true;
    const original = photo.original_path;
    const originalCache = originalKey(photo);
    const output = photo.output_path;
    Promise.all([studioApi.signedUrls('originals', [original]), studioApi.signedUrls('processed', output ? [output] : [])])
      .then(([o, p]) => {
        if (!active) return;
        setPictures({
          before: o[original] ? { url: o[original], path: originalCache } : null,
          after: output && p[output] ? { url: p[output], path: output } : null,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [photo]);

  if (!photo) return null;
  const canRetry = photo.process_status === 'failed' || isStuck(photo, now);

  const retry = async () => {
    setBusy(true);
    const result = await studioApi.startProcessing({ vehicleId: id, photoId });
    setBusy(false);
    setFailed('error' in result);
    refresh();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t(`slots.${photo.slot}`) }} />
      <CompareImage before={pictures.before} after={pictures.after} />
      <Text style={styles.status}>{t(`studio.status.${photo.process_status}`)}</Text>
      {canRetry ? <Button label={t('studio.retry')} onPress={retry} loading={busy} disabled={!online} /> : null}
      {failed ? <Notice kind="error" text={t('studio.errors.internal')} /> : null}
      {photo.process_status === 'done' && photo.placement ? (
        <Button
          variant="secondary"
          label={t('plates.adjustThis')}
          onPress={() => router.push({ pathname: '/vehicles/[id]/plates', params: { id, photoId } })}
        />
      ) : null}
      {photo.process_status === 'done' && photo.placement && photo.mask_path ? (
        <Button
          variant="secondary"
          label={t('touchUp.open')}
          onPress={() => router.push({ pathname: '/vehicles/[id]/touch-up', params: { id, photoId } })}
        />
      ) : null}
      <Button
        variant="secondary"
        label={t('studio.retake')}
        onPress={() => router.push({ pathname: '/vehicles/[id]/capture', params: { id, slot: photo.slot } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  status: { fontSize: fontSize.body, color: colors.textMuted },
});
