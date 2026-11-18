import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DAMAGE_PARTS, type DamageMap as Map, type DamagePart } from '../domain/vehicleData';
import { colors, damageColors } from '../ui/theme';
import { partAt } from './damage';
import { PART_PATHS } from './damageParts';

const W = 1000;
const H = 500;
const PARTS = DAMAGE_PARTS.map((id) => ({ id, path: Skia.Path.MakeFromSVGString(PART_PATHS[id])! }));

// The drawing is scaled to the width it is given; touches are scaled back into the 1000x500 box.
export function DamageMap({ map, selected, onSelect, label }: { map: Map; selected: DamagePart | null; onSelect: (part: DamagePart) => void; label: string }) {
  const [width, setWidth] = useState(0);
  const scale = width / W;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ aspectRatio: W / H }}>
      {width > 0 ? (
        <Pressable
          accessibilityRole="image"
          accessibilityLabel={label}
          style={StyleSheet.absoluteFill}
          onPress={(e) => {
            const part = partAt(PARTS, e.nativeEvent.locationX / scale, e.nativeEvent.locationY / scale);
            if (part) onSelect(part);
          }}
        >
          <Canvas style={{ width, height: width / 2 }} pointerEvents="none">
            {PARTS.map(({ id, path }) => (
              <Path key={id} path={path} transform={[{ scale }]} color={damageColors[map[id] ?? 'original']} />
            ))}
            {PARTS.map(({ id, path }) => (
              <Path
                key={`${id}-edge`}
                path={path}
                transform={[{ scale }]}
                style="stroke"
                strokeWidth={id === selected ? 6 : 2}
                color={id === selected ? colors.text : colors.border}
              />
            ))}
          </Canvas>
        </Pressable>
      ) : null}
    </View>
  );
}
