import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { VehicleState } from '../vehicle/stateLine';
import { colors, fontSize } from './theme';

const tone = { ok: colors.ok, wait: colors.wait, mark: colors.mark, neutral: colors.ink2 } as const;

// A vehicle's one-line state; the next step (mark) shows its exterior meter instead of a dot.
export function StateLine({ state }: { state: VehicleState }) {
  const { t } = useTranslation();
  const color = tone[state.tone];
  return (
    <View style={styles.wrap}>
      {state.meter ? (
        <View style={styles.meter} accessible={false}>
          {Array.from({ length: state.meter.total }, (_, i) => (
            <View key={i} style={[styles.segment, { backgroundColor: i < state.meter!.done ? colors.ink : colors.rule }]} />
          ))}
        </View>
      ) : null}
      <View style={styles.line}>
        {state.meter ? null : <View style={[styles.dot, { backgroundColor: color }]} />}
        <Text style={[styles.text, { color }, state.tone === 'mark' && styles.strong]}>{t(state.key, state.params ?? {})}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  meter: { flexDirection: 'row', gap: 3 },
  segment: { width: 14, height: 4, borderRadius: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: fontSize.small, flexShrink: 1 },
  strong: { fontWeight: '600' },
});
