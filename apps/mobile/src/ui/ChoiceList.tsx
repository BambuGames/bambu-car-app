import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, fontSize, radius, space } from './theme';

// A single choice as a sheet list: hairline rows, the chosen one marked with a check and the action colour.
export function ChoiceList<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.row, i < options.length - 1 && styles.rule, pressed && styles.pressed]}
          >
            <Text style={[styles.label, on && styles.on]}>{o.label}</Text>
            {on ? <Icon ios="checkmark" android="check" size={16} color={colors.action} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.sheet, borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.field, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingHorizontal: space[3], paddingVertical: space[2] },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  pressed: { backgroundColor: colors.paper },
  label: { flex: 1, fontSize: fontSize.body, color: colors.ink },
  on: { color: colors.action, fontWeight: '600' },
});
