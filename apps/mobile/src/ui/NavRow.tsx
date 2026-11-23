import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from './Icon';
import { colors, fontSize, radius, space } from './theme';

// A group of navigation rows on the sheet surface. `inset` rounds it inside a padded screen (iOS inset
// grouped list); without it the group runs edge to edge.
export function NavGroup({ children, inset = false }: { children: ReactNode; inset?: boolean }) {
  return <View style={[styles.group, inset && styles.inset]}>{children}</View>;
}

// One row: label, optional state on the right, chevron. At least 48 pt tall. At accessibility text sizes the
// state moves under the label (as iOS does), so neither is squeezed into breaking words.
export function NavRow({ label, state, stateTone, onPress, last = false }: {
  label: string;
  state?: string;
  stateTone?: 'normal' | 'mark';
  onPress: () => void;
  last?: boolean;
}) {
  const stacked = useWindowDimensions().fontScale > 1.5;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rule, pressed && styles.pressed]}>
      <View style={[styles.text, stacked && styles.stacked]}>
        <Text style={styles.label}>{label}</Text>
        {state ? <Text style={[styles.state, stacked && styles.stateStacked, stateTone === 'mark' && styles.mark]}>{state}</Text> : null}
      </View>
      <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.sheet, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  inset: { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingHorizontal: space[3], paddingVertical: space[2] },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  pressed: { backgroundColor: colors.paper },
  text: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: space[1] },
  label: { flexShrink: 1, flexGrow: 1, fontSize: fontSize.body, color: colors.ink },
  // At most half the row, so the row's own label always keeps room (large system text).
  state: { fontSize: fontSize.small, color: colors.ink2, textAlign: 'right', flexShrink: 1, maxWidth: '50%' },
  stateStacked: { textAlign: 'left', maxWidth: '100%' },
  mark: { color: colors.mark, fontWeight: '600' },
});
