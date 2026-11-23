import { StyleSheet, Text, View } from 'react-native';

import { CodeChip } from './CodeChip';
import { colors, fontSize } from './theme';

// A form field's label, led by its registration field code when the document has one.
export function FieldLabel({ label, code }: { label: string; code?: string | null }) {
  return (
    <View style={styles.row}>
      {code ? <CodeChip code={code} /> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  label: { fontSize: fontSize.small, fontWeight: '600', color: colors.ink, flexShrink: 1 },
});
