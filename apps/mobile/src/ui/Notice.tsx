import { StyleSheet, Text } from 'react-native';

import { colors, fontSize } from './theme';

export function Notice({ text, kind = 'info' }: { text: string; kind?: 'info' | 'error' }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.text, { color: kind === 'error' ? colors.danger : colors.textMuted }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({ text: { fontSize: fontSize.body, lineHeight: 22 } });
