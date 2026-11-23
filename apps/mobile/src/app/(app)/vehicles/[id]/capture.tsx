// Guided capture (design 6.3–6.4): landscape camera with the template silhouette, live guidance, automatic
// shot, quality check, then on to the next missing step of the section.
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Camera } from 'react-native-vision-camera';

import { nextSlot } from '../../../../capture/flow';
import { Overlay } from '../../../../capture/Overlay';
import { ReviewSheet } from '../../../../capture/ReviewSheet';
import type { TakenPhoto } from '../../../../capture/takePhoto';
import { useGuidedCamera } from '../../../../capture/useGuidedCamera';
import type { CaptureInfo, QcResult } from '../../../../domain/capture';
import { missingExterior } from '../../../../domain/progress';
import { isExterior, type Slot } from '../../../../domain/slots';
import type { Vehicle } from '../../../../domain/vehicle';
import { useSession } from '../../../../lib/session';
import { listPhotos, savePhoto, type PhotoRow } from '../../../../local/photos';
import { getVehicle } from '../../../../local/vehicles';
import { useSync } from '../../../../sync/SyncProvider';
import { Button } from '../../../../ui/Button';
import { colors, fontSize, radius, space } from '../../../../ui/theme';

type Shot = { taken: TakenPhoto; info: CaptureInfo; capturedAt: string };

const deleteFile = (uri: string) => {
  try {
    new File(uri).delete();
  } catch {
    // already gone
  }
};

export default function CaptureScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; slot: Slot }>();
  const { db, membership } = useSession();
  const { request } = useSync();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [slot, setSlot] = useState<Slot>(params.slot);
  const [review, setReview] = useState<Shot | null>(null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  useKeepAwake();

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        setFocused(false);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, []),
  );

  useEffect(() => {
    if (db && params.id) getVehicle(db, params.id).then(setVehicle);
  }, [db, params.id]);

  const exterior = isExterior(slot);
  const busy = review !== null || saving;
  const cam = useGuidedCamera({
    vehicleId: params.id,
    slot,
    bodyType: vehicle?.bodyType ?? 'other',
    // The session must keep running while a photo is taken and saved; it rests only under the review sheet.
    active: focused && review === null && vehicle !== null,
    busy,
    onAuto: () => shoot(true),
  });

  const finish = (photos: { slot: Slot }[]) => {
    const missing = missingExterior(photos);
    if (missing.length === 0) {
      router.back();
      return;
    }
    Alert.alert(
      t('capture.finishMissing.title'),
      missing.map((s) => t('capture.finishMissing.missing', { name: t(`slots.${s}`) })).join('\n'),
      [
        { text: t('capture.finishMissing.continue'), style: 'cancel', onPress: () => setSlot(missing[0]) },
        { text: t('capture.finishMissing.finish'), onPress: () => router.back() },
      ],
    );
  };

  const save = async (shot: Shot, accepted: boolean) => {
    if (!db || !membership || !vehicle) return;
    setSaving(true);
    const { metrics, issues } = shot.taken;
    const qc: QcResult = {
      issues,
      accepted,
      sharpness: metrics.sharpness,
      laplacianVar: metrics.laplacianVar,
      meanLuma: metrics.meanLuma,
      clippedShare: metrics.clippedShare,
    };
    const { replacedUri } = await savePhoto(db, {
      id: randomUUID(),
      vehicleId: vehicle.id,
      galleryId: membership.galleryId,
      slot,
      localUri: shot.taken.uri,
      capturedAt: shot.capturedAt,
      capture: shot.info,
      qc,
    });
    if (replacedUri && replacedUri !== shot.taken.uri) deleteFile(replacedUri);
    request();
    const photos: PhotoRow[] = await listPhotos(db, vehicle.id);
    setReview(null);
    setSaving(false);
    const next = nextSlot(slot, photos);
    if (next) setSlot(next);
    else finish(photos);
  };

  const shoot = async (auto: boolean) => {
    if (busy || !vehicle) return;
    setSaving(true);
    try {
      const capturedAt = new Date().toISOString();
      const { taken, info } = await cam.capture(auto, capturedAt);
      if (taken.issues.length > 0) {
        setSaving(false);
        setReview({ taken, info, capturedAt });
      } else {
        await save({ taken, info, capturedAt }, false);
      }
    } catch (error) {
      setSaving(false);
      if (__DEV__) console.warn('[capture]', String(error));
      Alert.alert(t('capture.failed'));
    }
  };

  const retake = () => {
    if (review) deleteFile(review.taken.uri);
    setReview(null);
  };

  const onFinishPress = async () => {
    if (db && vehicle) finish(await listPhotos(db, vehicle.id));
  };

  // 4:3 preview, as large as the area beside the controls allows.
  const previewWidth = Math.min(area.width, (area.height * 4) / 3);
  const previewHeight = (previewWidth * 3) / 4;

  const { permission } = cam;
  if (!permission.hasPermission) {
    return (
      <View style={[styles.center, styles.permission]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.centerText, styles.permissionText]}>{t('capture.permission')}</Text>
        <Button label={t('capture.allowCamera')} onPress={() => permission.requestPermission()} />
        <Button variant="secondary" label={t('capture.openSettings')} onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  const g = cam.guidance;
  const guideText = g.message
    ? t(`capture.messages.${g.message}`)
    : cam.simple
      ? t('capture.simple')
      : g.ready && exterior && cam.expected
        ? t('capture.ready')
        : null;
  const notes = [...g.warnings.map((w) => t(`capture.warnings.${w}`)), ...(cam.advice ? [t(`capture.advice.${cam.advice}`)] : [])];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.previewArea} onLayout={(e) => setArea(e.nativeEvent.layout)}>
        <View style={{ width: previewWidth, height: previewHeight }} onLayout={cam.onPreviewLayout}>
          {cam.cameraProps.device ? (
            <Camera style={StyleSheet.absoluteFill} {...cam.cameraProps} device={cam.cameraProps.device} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={colors.guide} />
              <Text style={styles.centerText}>{t('capture.loading')}</Text>
            </View>
          )}
          <Overlay
            path={cam.template?.path ?? null}
            expected={cam.expected}
            scale={cam.scale}
            width={previewWidth}
            height={previewHeight}
            ready={g.ready && cam.expected !== null}
          />
          {guideText ? (
            <View style={styles.messageBar}>
              <Text style={styles.message}>{guideText}</Text>
            </View>
          ) : null}
          {notes.length > 0 || !exterior ? (
            <View style={styles.noteBar}>
              {!exterior ? <Text style={styles.note}>{t(`capture.instructions.${slot}`)}</Text> : null}
              {notes.map((n) => (
                <Text key={n} style={styles.note}>
                  {n}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.sidebar}>
        <Text style={styles.step} numberOfLines={2}>
          {t(`slots.${slot}`)}
        </Text>
        {cam.wideAvailable ? (
          <View style={styles.modes}>
            {(['normal', 'wide'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: cam.mode === m }}
                onPress={() => cam.setMode(m)}
                style={[styles.mode, cam.mode === m && styles.modeSelected, m === 'wide' && cam.advice === 'suggestWide' && styles.modeSuggested]}
              >
                <Text style={[styles.modeText, cam.mode === m && styles.modeTextSelected]}>{t(`capture.${m}`)}</Text>
              </Pressable>
            ))}
            {cam.mode === 'wide' ? <Text style={styles.modeHint}>{t('capture.wideHint')}</Text> : null}
          </View>
        ) : null}
        {exterior && !cam.simple ? (
          <View style={styles.autoRow}>
            <Text style={styles.autoText}>{t('capture.auto')}</Text>
            <Switch value={cam.autoCapture} onValueChange={cam.setAutoCapture} />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('capture.shutter')}
          disabled={busy}
          onPress={() => shoot(false)}
          style={({ pressed }) => [styles.shutter, (pressed || busy) && styles.shutterPressed]}
        >
          {saving ? <ActivityIndicator color={colors.ink} /> : null}
        </Pressable>
        <Button variant="secondary" label={t('capture.finish')} onPress={onFinishPress} disabled={busy} />
      </View>

      {review ? (
        <ReviewSheet uri={review.taken.uri} issues={review.taken.issues} onRetake={retake} onUse={() => save(review, true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#000000' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[4], backgroundColor: '#000000' },
  centerText: { fontSize: fontSize.body, color: colors.guide, textAlign: 'center' },
  permission: { backgroundColor: colors.paper },
  permissionText: { color: colors.ink },
  messageBar: {
    position: 'absolute',
    top: space[2],
    alignSelf: 'center',
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radius,
    backgroundColor: '#000000',
  },
  message: { fontSize: fontSize.body, fontWeight: '600', color: colors.guide },
  noteBar: {
    position: 'absolute',
    bottom: space[2],
    left: space[2],
    right: space[2],
    gap: space[1],
    padding: space[2],
    borderRadius: radius,
    backgroundColor: '#000000',
  },
  note: { fontSize: fontSize.small, color: colors.guide },
  sidebar: { width: 200, padding: space[3], gap: space[3], justifyContent: 'center', backgroundColor: colors.paper },
  step: { fontSize: fontSize.body, fontWeight: '600', color: colors.ink },
  modes: { gap: space[1] },
  mode: { paddingVertical: space[2], paddingHorizontal: space[2], borderRadius: radius, borderWidth: 1, borderColor: colors.rule },
  modeSelected: { backgroundColor: colors.action, borderColor: colors.action },
  modeSuggested: { borderColor: colors.action, borderWidth: 2 },
  modeText: { fontSize: fontSize.small, color: colors.ink, textAlign: 'center' },
  modeTextSelected: { color: colors.onAction, fontWeight: '600' },
  modeHint: { fontSize: fontSize.small, color: colors.ink2 },
  autoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoText: { fontSize: fontSize.small, color: colors.ink },
  shutter: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.ink,
    backgroundColor: colors.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { opacity: 0.6 },
});
