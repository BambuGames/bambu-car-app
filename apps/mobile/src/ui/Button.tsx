import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius, space } from './theme';

type Variant = 'primary' | 'secondary' | 'danger';

// primary: the action green, one per screen · secondary: outlined · danger: outlined, mark text.
const labelColor: Record<Variant, string> = { primary: colors.onAction, secondary: colors.ink, danger: colors.mark };

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
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.outlined,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
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
  base: { minHeight: 50, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[3] },
  primary: { backgroundColor: colors.action },
  outlined: { borderWidth: 1, borderColor: colors.field, backgroundColor: colors.sheet },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  label: { fontSize: fontSize.body, fontWeight: '600', textAlign: 'center' },
});
