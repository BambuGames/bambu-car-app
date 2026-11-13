// A row of mutually exclusive options (before/after, touch-up mode, brush size).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, space } from './theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === o.value, disabled: !!o.disabled }}
          disabled={o.disabled}
          onPress={() => onChange(o.value)}
          style={[styles.option, value === o.value && styles.selected]}
        >
          <Text style={[styles.text, value === o.value && styles.selectedText, o.disabled && styles.disabled]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius, overflow: 'hidden' },
  option: { flex: 1, minHeight: 44, paddingVertical: space[2], alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.text },
  text: { fontSize: fontSize.body, color: colors.text },
  selectedText: { color: colors.background },
  disabled: { color: colors.textMuted },
});
