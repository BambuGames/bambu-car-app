// Four large handles over the processed photo, one per plate corner (design 7.4). Points are 0–1 of the
// output; the screen converts them to the original before saving. With zoom, the view is fixed at opening on
// the plate (plateView), so the photo never moves under the finger.
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { colors, radius } from '../ui/theme';
import type { Point } from './geometry';
import { moveCorner, plateView } from './plateQuad';

const HIT = 44; // touch target per corner, in points

export function PlateEditor({
  image,
  quad,
  onChange,
  zoom,
}: {
  image: { url: string; path: string } | null;
  quad: Point[];
  onChange: (q: Point[]) => void;
  zoom: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view] = useState(() => (zoom ? plateView(quad) : { x: 0, y: 0, scale: 1 }));
  const toScreen = (p: Point) => ({ x: (p.x - view.x) * view.scale * size.width, y: (p.y - view.y) * view.scale * size.height });
  // The responder is created once; it reads the latest values from here.
  const live = useRef({ quad, onChange, size, active: -1 });
  useEffect(() => {
    live.current = { ...live.current, quad, onChange, size };
  });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { quad: q, size: s } = live.current;
        const { locationX: x, locationY: y } = e.nativeEvent;
        let best = -1;
        let bestDist = HIT;
        q.forEach((p, i) => {
          const d = Math.hypot((p.x - view.x) * view.scale * s.width - x, (p.y - view.y) * view.scale * s.height - y);
          if (d < bestDist) {
            best = i;
            bestDist = d;
          }
        });
        live.current.active = best;
      },
      onPanResponderMove: (e) => {
        const { quad: q, size: s, active, onChange: change } = live.current;
        if (active < 0 || s.width === 0) return;
        const to = { x: view.x + e.nativeEvent.locationX / (view.scale * s.width), y: view.y + e.nativeEvent.locationY / (view.scale * s.height) };
        change(moveCorner(q, active, to));
      },
      onPanResponderRelease: () => {
        live.current.active = -1;
      },
    }),
  ).current;

  const corners = quad.map(toScreen);
  const path = Skia.Path.MakeFromSVGString(`M ${corners.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`) ?? Skia.Path.Make();

  return (
    <View style={styles.frame} onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)} {...responder.panHandlers}>
      {/* Touches must land on the frame: locationX/Y are measured from the view that was touched, and the
          zoomed photo starts outside the frame. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={image ? { uri: image.url, cacheKey: image.path } : undefined}
          style={{
            position: 'absolute',
            left: -view.x * view.scale * size.width,
            top: -view.y * view.scale * size.height,
            width: view.scale * size.width,
            height: view.scale * size.height,
          }}
          contentFit="contain"
        />
      </View>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={path} style="stroke" strokeWidth={5} color="rgba(0,0,0,0.55)" />
        <Path path={path} style="stroke" strokeWidth={2} color={colors.background} />
        {corners.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={11} color={colors.accent} />
        ))}
        {corners.map((p, i) => (
          <Circle key={`r${i}`} cx={p.x} cy={p.y} r={11} style="stroke" strokeWidth={2} color={colors.background} />
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface },
});
