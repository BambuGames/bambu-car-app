import { StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, fontSize } from './theme';

// info: quiet context · error: something failed · attention: the user's work is here (plate check, missing step).
export function Notice({ text, kind = 'info' }: { text: string; kind?: 'info' | 'error' | 'attention' }) {
  if (kind === 'attention') {
    return (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <Icon ios="exclamationmark.circle" android="error" size={18} color={colors.mark} />
        <Text style={[styles.text, styles.attention]}>{text}</Text>
      </View>
    );
  }
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.text, { color: kind === 'error' ? colors.mark : colors.ink2 }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  text: { fontSize: fontSize.body, lineHeight: 22, flexShrink: 1 },
  attention: { color: colors.mark, fontWeight: '600' },
});
