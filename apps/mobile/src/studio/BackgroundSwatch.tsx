// A small 4:3 preview of a background, drawn from its spec: wall, floor and the horizon in the middle,
// as the worker renders it (design 7.2.5). Image backgrounds show their name until their files exist.
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, space } from '../ui/theme';
import type { BackgroundSpec } from './api';

const W = 96;
const H = 72;

export function BackgroundSwatch({ spec, name, selected, onPress }: { spec: BackgroundSpec; name: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      onPress={onPress}
      style={styles.item}
    >
      <View style={[styles.frame, selected && styles.selected]}>
        {spec.kind === 'studio' ? (
          <Canvas style={styles.canvas}>
            <Rect x={0} y={0} width={W} height={H}>
              <LinearGradient start={vec(0, 0)} end={vec(0, H)} positions={[0, 0.46, 0.54, 1]} colors={[spec.wall, spec.wall, spec.floor, spec.floor]} />
            </Rect>
          </Canvas>
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

const styles = StyleSheet.create({
  item: { width: W + 8, gap: space[1], alignItems: 'center' },
  frame: { padding: 2, borderRadius: radius, borderWidth: 2, borderColor: colors.border },
  selected: { borderColor: colors.accent },
  canvas: { width: W, height: H, borderRadius: radius - 2, overflow: 'hidden' },
  placeholder: { backgroundColor: colors.surface },
  name: { fontSize: fontSize.small, color: colors.text },
});
