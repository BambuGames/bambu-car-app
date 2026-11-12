// The template silhouette over the 4:3 preview: white while guiding, green when everything holds (design 6.3).
import { Canvas, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import type { Box } from '../domain/templates';
import { colors } from '../ui/theme';

const VIEW_W = 1600; // template SVG view box (4:3)
const HALO = 'rgba(0,0,0,0.55)'; // dark edge under the line, so it stays visible on a white car or wall
const STROKES = [{ w: 7, halo: true }, { w: 3, halo: false }]; // screen pixels

export function Overlay({
  path,
  expected,
  scale,
  width,
  height,
  ready,
}: {
  path: string | null; // null: generic frame, drawn as the expected box
  expected: Box | null;
  scale: number; // silhouette scale for this phone's field of view
  width: number;
  height: number;
  ready: boolean;
}) {
  if (width === 0 || !expected) return null;
  const color = ready ? colors.ready : colors.guide;
  const skPath = path ? Skia.Path.MakeFromSVGString(path) : null;
  const k = width / VIEW_W;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {skPath ? (
        <Group
          transform={[
            { translateX: width / 2 },
            { translateY: height / 2 },
            { scale },
            { translateX: -width / 2 },
            { translateY: -height / 2 },
            { scale: k },
          ]}
        >
          {STROKES.map(({ w, halo }) => (
            <Path key={w} path={skPath} style="stroke" strokeWidth={w / (k * scale)} color={halo ? HALO : color} />
          ))}
        </Group>
      ) : (
        STROKES.map(({ w, halo }) => (
          <Rect
            key={w}
            x={expected.x0 * width}
            y={expected.y0 * height}
            width={(expected.x1 - expected.x0) * width}
            height={(expected.y1 - expected.y0) * height}
            style="stroke"
            strokeWidth={w}
            color={halo ? HALO : color}
          />
        ))
      )}
    </Canvas>
  );
}
