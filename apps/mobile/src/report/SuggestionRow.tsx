import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Vehicle } from '../domain/vehicle';
import { colors, fontSize, radius, space } from '../ui/theme';
import type { Suggestion } from './api';

export type Decision = 'accept' | 'reject';

const LISTS: Record<string, string> = {
  fuel: 'FUELS', transmission: 'TRANSMISSIONS', drive: 'DRIVES',
  colorExterior: 'EXTERIOR_COLORS', colorInterior: 'INTERIOR_COLORS', upholstery: 'UPHOLSTERIES',
};
const UNITS: Record<string, string> = { mileageKm: 'km', powerKw: 'kW', displacementCcm: 'cm³' };

// One suggestion with the vehicle's current value beside it and the two choices; the choice is the parent's state.
export function SuggestionRow({ suggestion, vehicle, decision, disabled, onDecide }: {
  suggestion: Suggestion; vehicle: Vehicle; decision?: Decision; disabled?: boolean; onDecide: (d: Decision) => void;
}) {
  const { t } = useTranslation();
  const yesNo = (v: boolean) => t(v ? 'vehicleData.yes' : 'vehicleData.no');
  const month = (v: string) => `${v.slice(5, 7)}.${v.slice(0, 4)}`;

  let label: string;
  let current: string;
  let next: string;
  if (suggestion.kind === 'damage') {
    label = t(`vehicleData.values.DAMAGE_PARTS.${suggestion.part}`);
    current = t(`vehicleData.values.DAMAGE_STATES.${vehicle.damage[suggestion.part] ?? 'original'}`);
    next = t(`vehicleData.values.DAMAGE_STATES.${suggestion.state}`);
  } else if (suggestion.kind === 'equipment') {
    label = t(`vehicleData.values.EQUIPMENT.${suggestion.code}`);
    current = yesNo(vehicle.details.equipment?.includes(suggestion.code) ?? false);
    next = yesNo(true);
  } else {
    const { field, value } = suggestion;
    label = t(field === 'make' || field === 'model' ? `vehicleForm.${field}` : `vehicleData.fields.${field}`);
    const show = (v: string | number | boolean | null | undefined): string => {
      if (v == null || v === '') return t('vehicleData.unknown');
      if (typeof v === 'boolean') return yesNo(v);
      if (typeof v === 'number') return `${v.toLocaleString()}${UNITS[field] ? ` ${UNITS[field]}` : ''}`;
      if (LISTS[field]) return t(`vehicleData.values.${LISTS[field]}.${v}`);
      return field === 'firstRegistration' || field === 'huUntil' ? month(v) : v;
    };
    current = show(field === 'make' ? vehicle.make : field === 'model' ? vehicle.model : vehicle.data[field] as string | number | boolean | null);
    next = show(value);
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.line}>
        {t('report.current')}: {current}
      </Text>
      <Text style={styles.value}>
        {t('report.suggested')}: {next}
      </Text>
      <Text style={styles.line}>
        {t('report.quote')}: „{suggestion.quote}“
      </Text>
      <View style={styles.buttons} accessibilityRole="radiogroup">
        {(['accept', 'reject'] as const).map((d) => (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ checked: decision === d, disabled }}
            disabled={disabled}
            onPress={() => onDecide(d)}
            style={[styles.choice, decision === d && styles.choiceOn]}
          >
            <Text style={[styles.choiceText, decision === d && styles.choiceTextOn]}>{t(`report.${d}`)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[1], paddingBottom: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  line: { fontSize: fontSize.small, color: colors.textMuted },
  value: { fontSize: fontSize.body, color: colors.text },
  buttons: { flexDirection: 'row', gap: space[2], marginTop: space[1] },
  choice: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius },
  choiceOn: { borderWidth: 2, borderColor: colors.accent },
  choiceText: { fontSize: fontSize.body, color: colors.text },
  choiceTextOn: { color: colors.accent, fontWeight: '600' },
});
