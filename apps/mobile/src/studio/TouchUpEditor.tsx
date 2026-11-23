// Touch-up (design 7.3, M0 decision): tap a leftover piece to remove it, or paint over leftovers. Edits are
// drawn on the processed output and stored on the original; the worker replays them on the stored mask.
// Two fingers zoom and move the photo. Leaving with unsaved edits asks first.
import { Canvas, Circle, Group, Path, Skia, type SkImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useNavigation, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';

import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Segmented } from '../ui/Segmented';
import { colors, fontSize, radius, space } from '../ui/theme';
import type { Picture } from './CompareImage';
import { simplify, toOriginalStroke, toOriginalTap, toOutputRadius, undo } from './edits';
import { originalToOutput, outputToOriginal, type Placement, type Point } from './geometry';
import { judgeRemove, labelParts } from './maskParts';
import { maskSnapshot } from './maskSnapshot';
import type { MaskEdit } from './status';
import { useViewportGestures } from './useViewportGestures';
import { frameToPhoto, photoToFrame } from './viewport';

// Brush radius as a share of the frame's width; on the photo it is divided by the zoom, so it paints finer.
const BRUSHES = { small: 0.01, medium: 0.025, large: 0.05 } as const;
type Brush = keyof typeof BRUSHES;
type Mode = 'remove' | 'erase';
type Stroke = { points: Point[]; brush: number }; // points 0–1 of the output, brush as a share of its width
const MARK = 0.45; // opacity of the marks over what will disappear

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function TouchUpEditor({
  image,
  mask,
  placement,
  edits: saved,
  canSave,
  onSave,
}: {
  image: Picture;
  mask: SkImage | null; // the stored car mask; without it every remove tap is accepted
  placement: Placement;
  edits: MaskEdit[];
  canSave: boolean;
  onSave: (edits: MaskEdit[]) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  // Compared with what the screen opened with, so a failed render after a saved row still counts as unsaved.
  const [initial] = useState(saved);
  const [edits, setEdits] = useState(saved);
  const [mode, setMode] = useState<Mode>('remove');
  const [brush, setBrush] = useState<Brush>('medium');
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [joined, setJoined] = useState(false);
  const dirty = JSON.stringify(edits) !== JSON.stringify(initial);

  // Leaving is checked after the next render, so the guard must stay off once a save went through.
  const disablePrevention = usePreventRemove(dirty && !saving, ({ repeat }) => {
    Alert.alert(t('touchUp.discardTitle'), t('touchUp.discardBody'), [
      { text: t('touchUp.keep'), style: 'cancel' },
      {
        text: t('touchUp.discard'),
        style: 'destructive',
        onPress: () => {
          setEdits(initial);
          repeat();
        },
      },
    ]);
  });

  const { view, pinch, pan, zoomed } = useViewportGestures({ x: 0, y: 0, scale: 1 }, size);
  const toPhoto = (x: number, y: number): Point => {
    const p = frameToPhoto(view, { x: x / size.width, y: y / size.height });
    return { x: clamp(p.x), y: clamp(p.y) };
  };

  // The stroke being painted is collected here (written only in the gesture callbacks) and mirrored to state
  // for drawing, so the last points are never lost to a render that has not happened yet.
  const painting = useRef<Stroke | null>(null);
  const paint = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    enabled: mode === 'erase',
    // The stroke starts where the finger came down, not where the pan was recognised a few points later.
    onBegin: (e) => {
      zoomed.current = false;
      if (size.width === 0) return;
      painting.current = { points: [toPhoto(e.x, e.y)], brush: BRUSHES[brush] / view.scale };
    },
    onActivate: (e) => {
      const current = painting.current;
      if (!current) return;
      painting.current = { ...current, points: [...current.points, toPhoto(e.x, e.y)] };
      setStroke(painting.current);
    },
    onUpdate: (e) => {
      const current = painting.current;
      if (!current || zoomed.current) return;
      painting.current = { ...current, points: [...current.points, toPhoto(e.x, e.y)] };
      setStroke(painting.current);
    },
    onDeactivate: (e) => {
      const finished = painting.current;
      painting.current = null;
      setStroke(null);
      if (!finished || e.canceled || zoomed.current) return;
      const points = simplify(finished.points);
      if (points.length > 0) setEdits((prev) => [...prev, toOriginalStroke(placement, points, finished.brush)]);
    },
    onFinalize: () => {
      painting.current = null;
      setStroke(null);
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    enabled: mode === 'remove',
    maxDistance: 10, // gesture-handler taps have no movement limit of their own: a quick swipe was a tap on Android
    onBegin: () => {
      zoomed.current = false;
    },
    onActivate: (e) => {
      if (size.width === 0 || zoomed.current) return;
      const at = toPhoto(e.x, e.y);
      // The worker only drops parts apart from the car: say so instead of storing a tap that does nothing.
      // Worked out on tap, not per render: a 512 px snapshot with the erase strokes so far.
      const snapshot = mask ? maskSnapshot(mask, edits) : null;
      const parts = snapshot ? labelParts(snapshot.alpha, snapshot.width, snapshot.height) : null;
      const verdict = judgeRemove(parts, outputToOriginal(placement, at));
      setJoined(verdict === 'joined');
      if (verdict === 'accept') setEdits((prev) => [...prev, toOriginalTap(placement, at)]);
    },
  });
  const gestures = useSimultaneousGestures(pinch, pan, paint, tap);

  const done = async () => {
    if (!dirty) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    if (await onSave(edits)) {
      disablePrevention();
      navigation.goBack();
    } else {
      setSaving(false);
    }
  };

  const onScreen = (p: Point) => {
    const f = photoToFrame(view, p);
    return { x: f.x * size.width, y: f.y * size.height };
  };
  const toScreen = (p: Point) => {
    const s = onScreen(p);
    return `${s.x} ${s.y}`;
  };
  // A one-point stroke is drawn as a dot, as the worker does.
  const pathOf = (points: Point[]) =>
    Skia.Path.MakeFromSVGString(`M ${points.map(toScreen).join(' L ')}${points.length === 1 ? ` L ${toScreen(points[0])}` : ''}`) ?? Skia.Path.Make();
  const fromOriginal = ([x, y]: [number, number]) => onScreen(originalToOutput(placement, { x, y }));
  const topLeft = photoToFrame(view, { x: 0, y: 0 });

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gestures}>
        <View style={styles.frame} onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)}>
          <Image
            source={{ uri: image.url, cacheKey: image.path }}
            style={{
              position: 'absolute',
              left: topLeft.x * size.width,
              top: topLeft.y * size.height,
              width: view.scale * size.width,
              height: view.scale * size.height,
            }}
            contentFit="contain"
          />
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {edits.map((edit, i) =>
              edit.type === 'erase' ? (
                <Path
                  key={i}
                  path={pathOf(edit.points.map(([x, y]) => originalToOutput(placement, { x, y })))}
                  style="stroke"
                  strokeWidth={2 * toOutputRadius(placement, edit.radius) * size.width * view.scale}
                  strokeCap="round"
                  strokeJoin="round"
                  color={colors.mark}
                  opacity={MARK}
                />
              ) : (
                <Group key={i}>
                  <Circle cx={fromOriginal(edit.point).x} cy={fromOriginal(edit.point).y} r={11} color={colors.mark} />
                  {/* A ring, so the mark shows on a red car too. */}
                  <Circle
                    cx={fromOriginal(edit.point).x}
                    cy={fromOriginal(edit.point).y}
                    r={11}
                    style="stroke"
                    strokeWidth={3}
                    color={colors.paper}
                  />
                </Group>
              ),
            )}
            {stroke ? (
              <Path
                path={pathOf(stroke.points)}
                style="stroke"
                strokeWidth={2 * stroke.brush * size.width * view.scale}
                strokeCap="round"
                strokeJoin="round"
                color={colors.mark}
                opacity={MARK}
              />
            ) : null}
          </Canvas>
        </View>
      </GestureDetector>

      <Segmented
        label={t('touchUp.mode')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'remove', label: t('touchUp.remove') },
          { value: 'erase', label: t('touchUp.erase') },
        ]}
      />
      <Text style={styles.hint}>{t(mode === 'remove' ? 'touchUp.removeHint' : 'touchUp.eraseHint')}</Text>
      {joined && mode === 'remove' ? <Notice text={t('touchUp.removeJoined')} /> : null}
      {mode === 'erase' ? (
        <Segmented
          label={t('touchUp.brush')}
          value={brush}
          onChange={setBrush}
          options={(Object.keys(BRUSHES) as Brush[]).map((b) => ({ value: b, label: t(`touchUp.${b}`) }))}
        />
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button variant="secondary" label={t('touchUp.undo')} onPress={() => setEdits(undo)} disabled={edits.length === 0 || saving} />
        </View>
        <View style={styles.action}>
          <Button label={t('touchUp.done')} onPress={done} loading={saving} disabled={dirty && !canSave} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.sheet },
  hint: { fontSize: fontSize.small, color: colors.ink2 },
  actions: { flexDirection: 'row', gap: space[3] },
  action: { flex: 1 },
});
