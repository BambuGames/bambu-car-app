// The gallery's latest processed photo (or a grey 4:3 field) with the band and logo where the worker will
// put them: the layout is worked out on the 2560×1920 output and scaled to the preview.
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { OUTPUT } from '../studio/geometry';
import { colors, radius } from '../ui/theme';
import { watermarkLayout, type WatermarkSettings } from './watermarkLayout';

export function WatermarkPreview({
  photoUrl,
  logo,
  settings,
}: {
  photoUrl: string | null;
  logo: { url: string; aspect: number } | null;
  settings: WatermarkSettings;
}) {
  const [width, setWidth] = useState(0);
  const k = width / OUTPUT.width;
  const { band, logo: place } = watermarkLayout(settings, logo?.aspect ?? null, OUTPUT.width, OUTPUT.height);
  return (
    <View style={styles.frame} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible={false}>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {band && width > 0 ? <View style={[styles.layer, { top: band.y * k, height: band.h * k, backgroundColor: band.color }]} /> : null}
      {logo && place && width > 0 ? (
        <Image
          source={{ uri: logo.url }}
          style={{ position: 'absolute', left: place.x * k, top: place.y * k, width: place.w * k, height: place.h * k, opacity: place.opacity }}
          contentFit="fill"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.rule },
  layer: { position: 'absolute', left: 0, right: 0 },
});
