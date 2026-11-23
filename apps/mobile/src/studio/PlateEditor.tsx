// Four large handles over the processed photo, one per plate corner (design 7.4). Points are 0–1 of the
// output; the screen converts them to the original before saving. With zoom, the view opens on the plate
// (plateView); two fingers zoom and move the photo from there, one finger drags the nearest corner.
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture, useSimultaneousGestures } from 'react-native-gesture-handler';

import { colors, radius } from '../ui/theme';
import type { Point } from './geometry';
import { moveCorner, plateView } from './plateQuad';
import { useViewportGestures } from './useViewportGestures';
import { frameToPhoto, photoToFrame } from './viewport';

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
  const { view, pinch, pan, zoomed } = useViewportGestures(zoom ? plateView(quad) : { x: 0, y: 0, scale: 1 }, size);
  const toScreen = (p: Point) => {
    const f = photoToFrame(view, p);
    return { x: f.x * size.width, y: f.y * size.height };
  };
  const active = useRef(-1);

  const drag = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    onBegin: (e) => {
      zoomed.current = false;
      let best = -1;
      let bestDist = HIT;
      quad.forEach((p, i) => {
        const s = toScreen(p);
        const d = Math.hypot(s.x - e.x, s.y - e.y);
        if (d < bestDist) {
          best = i;
          bestDist = d;
        }
      });
      active.current = best;
    },
    onUpdate: (e) => {
      if (active.current < 0 || zoomed.current || size.width === 0) return;
      onChange(moveCorner(quad, active.current, frameToPhoto(view, { x: e.x / size.width, y: e.y / size.height })));
    },
    onFinalize: () => {
      active.current = -1;
    },
  });
  const gestures = useSimultaneousGestures(pinch, pan, drag);

  const corners = quad.map(toScreen);
  const path = Skia.Path.MakeFromSVGString(`M ${corners.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`) ?? Skia.Path.Make();
  const topLeft = photoToFrame(view, { x: 0, y: 0 });

  return (
    <GestureDetector gesture={gestures}>
      <View style={styles.frame} onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={image ? { uri: image.url, cacheKey: image.path } : undefined}
            style={{
              position: 'absolute',
              left: topLeft.x * size.width,
              top: topLeft.y * size.height,
              width: view.scale * size.width,
              height: view.scale * size.height,
            }}
            contentFit="contain"
          />
        </View>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path path={path} style="stroke" strokeWidth={5} color="rgba(0,0,0,0.55)" />
          <Path path={path} style="stroke" strokeWidth={2} color={colors.paper} />
          {corners.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={11} color={colors.action} />
          ))}
          {corners.map((p, i) => (
            <Circle key={`r${i}`} cx={p.x} cy={p.y} r={11} style="stroke" strokeWidth={2} color={colors.paper} />
          ))}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.sheet },
});
