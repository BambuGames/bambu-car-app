import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FieldLabel } from './FieldLabel';
import { colors, fontSize, radius, space } from './theme';

export function TextField({
  label,
  code,
  error,
  ...input
}: { label: string; code?: string | null; error?: string | null } & TextInputProps) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} code={code} />
      <TextInput
        autoCorrect={false}
        spellCheck={false}
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.ink2}
        style={[styles.input, input.multiline ? styles.multiline : null, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.field,
    borderRadius: radius,
    paddingHorizontal: space[2],
    fontSize: fontSize.body,
    color: colors.ink,
    backgroundColor: colors.sheet,
  },
  // A multiline field grows with its text; without vertical padding it ends at the last line and clips its descenders.
  multiline: { paddingVertical: space[2], textAlignVertical: 'top' },
  inputError: { borderColor: colors.mark },
  error: { fontSize: fontSize.small, color: colors.mark },
});
