// A labelled field that opens a list of options in a sheet. The first row clears the choice.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, radius, space } from './theme';

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  clearLabel,
  closeLabel,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
  clearLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label;
  const pick = (v: T | null) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current ?? '' }}
        onPress={() => setOpen(true)}
        style={styles.input}
      >
        <Text style={[styles.value, !current && styles.empty]}>{current ?? '–'}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {label}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.closeText}>{closeLabel}</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Pressable accessibilityRole="button" onPress={() => pick(null)} style={styles.row}>
              <Text style={styles.clear}>{clearLabel}</Text>
            </Pressable>
            {options.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: o.value === value }}
                onPress={() => pick(o.value)}
                style={styles.row}
              >
                <Text style={[styles.rowText, o.value === value && styles.selected]}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  label: { fontSize: fontSize.small, fontWeight: '500', color: colors.text },
  input: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: space[2],
  },
  value: { fontSize: fontSize.body, color: colors.text },
  empty: { color: colors.textMuted },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[3] },
  sheetTitle: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  close: { minHeight: 44, justifyContent: 'center' },
  closeText: { fontSize: fontSize.body, color: colors.accent },
  row: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { fontSize: fontSize.body, color: colors.text },
  selected: { color: colors.accent, fontWeight: '600' },
  clear: { fontSize: fontSize.body, color: colors.textMuted },
});
