import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '../ui/theme';
import { POSTER_SIZE, type PosterFormat } from './posterModel';

/** The poster as it will be shared; the ratio follows the format. A poster rewritten at the same path needs a new `key`. */
export function PosterPreview({ uri, label, format = '4:5' }: { uri: string | null; label: string; format?: PosterFormat }) {
  const { width, height } = POSTER_SIZE[format];
  return (
    <View style={[styles.frame, { aspectRatio: width / height }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="none" accessibilityLabel={label} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ frame: { width: '100%', backgroundColor: colors.sheet } });
