import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius, space } from './theme';

type Variant = 'primary' | 'secondary' | 'danger';

const labelColor: Record<Variant, string> = { primary: colors.background, secondary: colors.text, danger: colors.danger };

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.base, variant === 'primary' && styles.primary, (pressed || disabled) && styles.dimmed]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <Text style={[styles.label, { color: labelColor[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[3] },
  primary: { backgroundColor: colors.accent },
  dimmed: { opacity: 0.6 },
  label: { fontSize: fontSize.body, fontWeight: '600' },
});
