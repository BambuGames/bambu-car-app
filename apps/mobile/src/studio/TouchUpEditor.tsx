// Touch-up (design 7.3, M0 decision): tap a leftover piece to remove it, or paint over leftovers. Edits are
// drawn on the processed output and stored on the original; the worker replays them on the stored mask.
// Leaving with unsaved edits asks first.
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { colors, fontSize, radius, space } from '../ui/theme';
import type { Picture } from './CompareImage';
import { simplify, toOriginalStroke, toOriginalTap, toOutputRadius, undo } from './edits';
import { originalToOutput, type Placement, type Point } from './geometry';
import type { MaskEdit } from './status';

// Brush radius as a share of the output's width.
const BRUSHES = { small: 0.01, medium: 0.025, large: 0.05 } as const;
type Brush = keyof typeof BRUSHES;
type Mode = 'remove' | 'erase';
const TAP_SLOP = 10; // points a tap may move and still count as a tap
const MARK = 0.45; // opacity of the marks over what will disappear

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function TouchUpEditor({
  image,
  placement,
  edits: saved,
  canSave,
  onSave,
}: {
  image: Picture;
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
  const [stroke, setStroke] = useState<Point[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
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

  // The responder is created once; it reads the latest values from here.
  const live = useRef({ mode, brush, size, placement, start: { x: 0, y: 0 }, points: [] as Point[] });
  useEffect(() => {
    live.current = { ...live.current, mode, brush, size, placement };
  });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const l = live.current;
        const { locationX: x, locationY: y } = e.nativeEvent;
        l.start = { x, y };
        l.points = [{ x: clamp(x / l.size.width), y: clamp(y / l.size.height) }];
        if (l.mode === 'erase') setStroke(l.points);
      },
      onPanResponderMove: (e) => {
        const l = live.current;
        if (l.mode !== 'erase') return;
        l.points = [...l.points, { x: clamp(e.nativeEvent.locationX / l.size.width), y: clamp(e.nativeEvent.locationY / l.size.height) }];
        setStroke(l.points);
      },
      onPanResponderRelease: (e) => {
        const l = live.current;
        if (l.mode === 'remove') {
          const moved = Math.hypot(e.nativeEvent.locationX - l.start.x, e.nativeEvent.locationY - l.start.y);
          if (moved <= TAP_SLOP) setEdits((prev) => [...prev, toOriginalTap(l.placement, l.points[0])]);
          return;
        }
        const points = simplify(l.points);
        setEdits((prev) => [...prev, toOriginalStroke(l.placement, points, BRUSHES[l.brush])]);
        setStroke([]);
      },
      onPanResponderTerminate: () => setStroke([]),
    }),
  ).current;

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

  const toScreen = (p: Point) => `${p.x * size.width} ${p.y * size.height}`;
  // A one-point stroke is drawn as a dot, as the worker does.
  const pathOf = (points: Point[]) =>
    Skia.Path.MakeFromSVGString(`M ${points.map(toScreen).join(' L ')}${points.length === 1 ? ` L ${toScreen(points[0])}` : ''}`) ?? Skia.Path.Make();
  const fromOriginal = ([x, y]: [number, number]) => originalToOutput(placement, { x, y });

  return (
    <View style={styles.wrap}>
      <View style={styles.frame} onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)} {...responder.panHandlers}>
        <Image source={{ uri: image.url, cacheKey: image.path }} style={StyleSheet.absoluteFill} contentFit="contain" />
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {edits.map((edit, i) =>
            edit.type === 'erase' ? (
              <Path
                key={i}
                path={pathOf(edit.points.map(fromOriginal))}
                style="stroke"
                strokeWidth={2 * toOutputRadius(placement, edit.radius) * size.width}
                strokeCap="round"
                strokeJoin="round"
                color={colors.danger}
                opacity={MARK}
              />
            ) : (
              <Group key={i}>
                <Circle cx={fromOriginal(edit.point).x * size.width} cy={fromOriginal(edit.point).y * size.height} r={11} color={colors.danger} />
                {/* A ring, so the mark shows on a red car too. */}
                <Circle
                  cx={fromOriginal(edit.point).x * size.width}
                  cy={fromOriginal(edit.point).y * size.height}
                  r={11}
                  style="stroke"
                  strokeWidth={3}
                  color={colors.background}
                />
              </Group>
            ),
          )}
          {stroke.length > 0 ? (
            <Path
              path={pathOf(stroke)}
              style="stroke"
              strokeWidth={2 * BRUSHES[brush] * size.width}
              strokeCap="round"
              strokeJoin="round"
              color={colors.danger}
              opacity={MARK}
            />
          ) : null}
        </Canvas>
      </View>

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
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface },
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: space[3] },
  action: { flex: 1 },
});
