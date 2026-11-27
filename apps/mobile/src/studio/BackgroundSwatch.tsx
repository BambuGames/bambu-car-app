// A small 4:3 preview of a background, drawn from its spec: wall, floor and the horizon in the middle,
// as the worker renders it (design 7.2.5); a showroom as a corner of the room (swatch.ts). Image backgrounds
// show their name until their files exist.
import { Canvas, LinearGradient, Line, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, space } from '../ui/theme';
import type { BackgroundSpec } from './api';
import { showroomSwatch } from './swatch';

const W = 96;
const H = 72;

export function BackgroundSwatch({
  spec,
  name,
  selected,
  disabled = false,
  onPress,
}: {
  spec: BackgroundSpec;
  name: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={name}
      onPress={onPress}
      disabled={disabled}
      style={[styles.item, disabled && styles.disabled]}
    >
      <View style={[styles.frame, selected && styles.selected]}>
        {spec.kind === 'studio' ? (
          <Canvas style={styles.canvas}>
            <Rect x={0} y={0} width={W} height={H}>
              <LinearGradient start={vec(0, 0)} end={vec(0, H)} positions={[0, 0.46, 0.54, 1]} colors={[spec.wall, spec.wall, spec.floor, spec.floor]} />
            </Rect>
          </Canvas>
        ) : spec.kind === 'showroom' ? (
          <ShowroomPreview spec={spec} />
        ) : (
          <View style={[styles.canvas, styles.placeholder]} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

function ShowroomPreview({ spec }: { spec: Extract<BackgroundSpec, { kind: 'showroom' }> }) {
  const { polygons, lines } = showroomSwatch(spec, W, H);
  return (
    <Canvas style={styles.canvas}>
      {polygons.map((p, i) => (
        <Path key={i} path={Skia.Path.Polygon(p.points.map(([x, y]) => vec(x, y)), true)} color={p.fill} />
      ))}
      {lines.map((l, i) => (
        <Line key={i} p1={vec(...l.from)} p2={vec(...l.to)} color={l.color} strokeWidth={1} />
      ))}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  item: { width: W + 8, gap: space[1], alignItems: 'center' },
  frame: { padding: 2, borderRadius: radius, borderWidth: 2, borderColor: colors.rule },
  selected: { borderColor: colors.action },
  canvas: { width: W, height: H, borderRadius: radius - 2, overflow: 'hidden' },
  placeholder: { backgroundColor: colors.sheet },
  name: { fontSize: fontSize.small, color: colors.ink },
  disabled: { opacity: 0.5 },
});
