import { StyleSheet, Text, View } from 'react-native';

import { CodeChip } from './CodeChip';
import { colors, fonts } from './theme';

// A vehicle fact: its field code, then the value in tabular figures. An empty value shows "—" in ink2.
export function Fact({ code, value }: { code: string; value: string | null }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${code} ${value ?? '—'}`}>
      <CodeChip code={code} />
      <Text style={[styles.value, value === null && styles.empty]}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, maxWidth: '100%' },
  value: { flexShrink: 1, fontFamily: fonts.value, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  empty: { color: colors.ink2 },
});
