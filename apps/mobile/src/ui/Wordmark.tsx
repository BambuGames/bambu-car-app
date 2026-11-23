import { StyleSheet, Text } from 'react-native';

import { colors, fonts } from './theme';

// The product name as it appears in the app: lowercase, ".ai" in the secondary ink.
export function Wordmark({ size = 16, maxFontSizeMultiplier }: { size?: number; maxFontSizeMultiplier?: number }) {
  return (
    <Text style={[styles.mark, { fontSize: size }]} maxFontSizeMultiplier={maxFontSizeMultiplier} accessibilityRole="header" accessibilityLabel="photocar.ai">
      photocar<Text style={styles.ai}>.ai</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: { fontFamily: fonts.title, color: colors.ink, letterSpacing: 0.3 },
  ai: { color: colors.ink2 },
});
