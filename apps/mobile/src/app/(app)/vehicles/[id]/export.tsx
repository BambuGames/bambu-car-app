// Export (spec 10): save the chosen photos into the phone's photos, or share a ZIP link for a computer.
// Watermarked, plain or originals; named in listing order. Online only; no credit.
import { Image } from 'expo-image';
import * as Network from 'expo-network';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { createExportLink } from '../../../../export/api';
import { deviceSaveDeps } from '../../../../export/device';
import { exportItems, type ExportVersion } from '../../../../export/plan';
import { saveToPhotos } from '../../../../export/save';
import { supabase } from '../../../../lib/supabase';
import { StudioLoadState } from '../../../../studio/LoadState';
import { originalKey } from '../../../../studio/status';
import { studioApi, useStudio } from '../../../../studio/useStudio';
import { Button } from '../../../../ui/Button';
import { Notice } from '../../../../ui/Notice';
import { Segmented } from '../../../../ui/Segmented';
import { colors, fontSize, radius, space } from '../../../../ui/theme';

type Message = { kind: 'info' | 'error'; text: string; settings?: boolean };
type Thumb = { url: string; key: string };

export default function ExportScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refresh } = useStudio(id);
  const network = Network.useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const [version, setVersion] = useState<ExportVersion>('watermarked');
  // Everything starts selected; tapping a photo leaves it out.
  const [leftOut, setLeftOut] = useState<ReadonlySet<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, Thumb>>({});
  const [progress, setProgress] = useState<{ done: number; count: number } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // Small pictures: the processed output where there is one (it never changes path), else the original.
  useEffect(() => {
    const photos = data?.photos ?? [];
    let active = true;
    const outputs = photos.filter((p) => p.output_path).map((p) => p.output_path!);
    const originals = photos.filter((p) => !p.output_path).map((p) => p.original_path);
    Promise.all([studioApi.signedUrls('processed', outputs), studioApi.signedUrls('originals', originals)])
      .then(([o, r]) => {
        if (!active) return;
        const next: Record<string, Thumb> = {};
        for (const p of photos) {
          if (p.output_path && o[p.output_path]) next[p.id] = { url: o[p.output_path], key: p.output_path };
          else if (r[p.original_path]) next[p.id] = { url: r[p.original_path], key: originalKey(p) };
        }
        setThumbs(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [data]);

  if (!data) return <StudioLoadState error={error} online={online} onRetry={refresh} />;
  const available = exportItems(data.photos, version);
  const chosen = new Set(available.map((i) => i.photoId).filter((p) => !leftOut.has(p)));
  const items = exportItems(data.photos, version, chosen);
  const slotOf = new Map(data.photos.map((p) => [p.id, p.slot]));
  const busy = progress !== null || linkBusy;

  const toggle = (photoId: string) => {
    const next = new Set(leftOut);
    if (next.has(photoId)) next.delete(photoId);
    else next.add(photoId);
    setLeftOut(next);
  };

  const save = async () => {
    setMessage(null);
    setProgress({ done: 0, count: items.length });
    try {
      const result = await saveToPhotos(items, deviceSaveDeps, (done) => setProgress({ done, count: items.length }));
      if (result.status === 'denied') setMessage({ kind: 'error', text: t('export.denied'), settings: true });
      else if (result.failed === 0) setMessage({ kind: 'info', text: t('export.saved', { count: result.saved }) });
      else setMessage({ kind: 'error', text: t('export.savedWithFailures', { saved: result.saved, failed: result.failed }) });
    } catch {
      setMessage({ kind: 'error', text: t('export.errors.internal') }); // the permission request itself failed
    } finally {
      setProgress(null);
    }
  };

  const shareLink = async () => {
    setMessage(null);
    setLinkBusy(true);
    try {
      const result = await createExportLink(supabase, { vehicleId: id, version, photoIds: items.map((i) => i.photoId) });
      if ('error' in result) {
        setMessage({ kind: 'error', text: t(`export.errors.${result.error}`) });
        return;
      }
      const date = new Date(result.expiresAt).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hint = t('export.linkHint', { date });
      setMessage({ kind: 'info', text: hint });
      await Share.share({ message: `${hint}\n${result.url}` });
    } catch {
      setMessage({ kind: 'error', text: t('export.errors.internal') }); // the share sheet could not open
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Segmented
        label={t('export.version')}
        value={version}
        onChange={setVersion}
        options={(['watermarked', 'plain', 'originals'] as const).map((v) => ({ value: v, label: t(`export.versions.${v}`) }))}
      />
      {available.length === 0 ? (
        <Notice text={t('export.nothing')} />
      ) : (
        <>
          <View style={styles.selectionRow}>
            <Text style={styles.hint}>{t('export.selected', { count: items.length, total: available.length })}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLeftOut(items.length > 0 ? new Set(available.map((i) => i.photoId)) : new Set())}
              hitSlop={space[2]}
            >
              <Text style={styles.link}>{t(items.length > 0 ? 'export.selectNone' : 'export.selectAll')}</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {available.map((item) => {
              const on = chosen.has(item.photoId);
              const thumb = thumbs[item.photoId];
              return (
                <Pressable
                  key={item.photoId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(`slots.${slotOf.get(item.photoId)}`)}
                  onPress={() => toggle(item.photoId)}
                  style={styles.tile}
                >
                  <Image
                    source={thumb ? { uri: thumb.url, cacheKey: thumb.key } : undefined}
                    style={[styles.thumb, !on && styles.thumbOff]}
                    contentFit="cover"
                    accessible={false}
                  />
                  <View style={[styles.check, on && styles.checkOn]} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Button
        label={progress ? t('export.saving', { done: progress.done, count: progress.count }) : t('export.save', { count: items.length })}
        onPress={save}
        loading={progress !== null}
        disabled={items.length === 0 || !online || busy}
      />
      <Button variant="secondary" label={t('export.link')} onPress={shareLink} loading={linkBusy} disabled={items.length === 0 || !online || busy} />
      {!online ? <Notice text={t('common.offline')} /> : null}
      {message ? <Notice kind={message.kind} text={message.text} /> : null}
      {message?.settings ? <Button variant="secondary" label={t('export.openSettings')} onPress={() => Linking.openSettings()} /> : null}
    </ScrollView>
  );
}

const CHECK = 22;
const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  selectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  link: { fontSize: fontSize.small, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  tile: { width: '31%' },
  thumb: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.surface },
  thumbOff: { opacity: 0.35 },
  // A selection mark in the corner: filled when the photo is in the set.
  check: {
    position: 'absolute', top: space[1], right: space[1], width: CHECK, height: CHECK, borderRadius: CHECK / 2,
    borderWidth: 2, borderColor: colors.background, backgroundColor: 'rgba(0,0,0,0.25)',
  },
  checkOn: { backgroundColor: colors.text },
});
