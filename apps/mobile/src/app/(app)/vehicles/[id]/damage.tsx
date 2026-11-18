import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Vehicle } from '../../../../domain/vehicle';
import { DAMAGE_STATES, type DamagePart, type DamageState } from '../../../../domain/vehicleData';
import { useSession } from '../../../../lib/session';
import { getVehicle, updateVehicle } from '../../../../local/vehicles';
import { useSync } from '../../../../sync/SyncProvider';
import { EditingElsewhere } from '../../../../vehicle/EditingElsewhere';
import { Notice } from '../../../../ui/Notice';
import { Button } from '../../../../ui/Button';
import { Screen } from '../../../../ui/Screen';
import { colors, damageColors, fontSize, radius, space } from '../../../../ui/theme';
import { DamageMap } from '../../../../vehicle/DamageMap';
import { damageSummary, setPartState } from '../../../../vehicle/damage';

export default function DamageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db } = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (!db || !id) return;
    let active = true;
    getVehicle(db, id).then((v) => active && setVehicle(v));
    return () => {
      active = false;
    };
  }, [db, id]);

  return vehicle ? <Editor initial={vehicle} /> : null;
}

function Editor({ initial }: { initial: Vehicle }) {
  const { t, i18n } = useTranslation();
  const { db } = useSession();
  const { request } = useSync();
  const [vehicle, setVehicle] = useState(initial);
  const [selected, setSelected] = useState<DamagePart | null>(null);
  const [error, setError] = useState(false);

  // Latest vehicle, written only in handlers. Patches are built from it (not from the render closure) and
  // writes run one after another on a chain, so quick successive taps neither lose nor reorder changes.
  const latest = useRef(initial);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const save = (patch: Parameters<typeof updateVehicle>[2]) => {
    if (!db) return;
    latest.current = { ...latest.current, ...patch } as Vehicle;
    setVehicle(latest.current);
    setError(false);
    chain.current = chain.current
      .then(() => updateVehicle(db, latest.current.id, patch, new Date().toISOString()))
      .then(() => request())
      .catch(async () => {
        setError(true);
        // Back to what is actually stored.
        const stored = await getVehicle(db, latest.current.id).catch(() => null);
        if (stored) {
          latest.current = stored;
          setVehicle(stored);
        }
      });
  };
  const setState = (part: DamagePart, state: DamageState) => {
    const { damage, damageCheckedAt } = latest.current;
    // A change after the "all parts checked" confirmation moves its date (spec 5.5); before it, the date stays empty.
    save({ damage: setPartState(damage, part, state), ...(damageCheckedAt ? { damageCheckedAt: new Date().toISOString() } : {}) });
  };

  const summary = damageSummary(vehicle.damage);
  const marked = (['painted', 'partly_painted', 'replaced', 'damaged'] as const).filter((s) => summary[s].length > 0);
  const partName = (part: DamagePart) => t(`vehicleData.values.DAMAGE_PARTS.${part}`);
  const stateName = (state: DamageState) => t(`vehicleData.values.DAMAGE_STATES.${state}`);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('damage.title') }} />
      <EditingElsewhere vehicleId={vehicle.id} />
      <Text style={styles.hint}>{t('damage.hint')}</Text>
      {error ? <Notice kind="error" text={t('auth.errors.generic')} /> : null}
      <DamageMap map={vehicle.damage} selected={selected} onSelect={setSelected} label={t('damage.map')} />
      <View style={styles.legend} accessibilityLabel={t('damage.legend')}>
        {DAMAGE_STATES.map((state) => (
          <View key={state} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: damageColors[state] }]} />
            <Text style={styles.hint}>{stateName(state)}</Text>
          </View>
        ))}
      </View>

      {selected ? (
        <View style={styles.group} accessibilityRole="radiogroup">
          <Text style={styles.title}>{partName(selected)}</Text>
          {DAMAGE_STATES.map((state) => {
            const on = (vehicle.damage[selected] ?? 'original') === state;
            return (
              <Pressable
                key={state}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setState(selected, state)}
                style={[styles.option, on && styles.optionOn]}
              >
                <View style={[styles.swatch, { backgroundColor: damageColors[state] }]} />
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{stateName(state)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {marked.length === 0 ? (
        <Text style={styles.hint}>{t('damage.none')}</Text>
      ) : (
        marked.map((state) => (
          <View key={state} style={styles.group}>
            <Text style={styles.label}>{stateName(state)}</Text>
            <Text style={styles.body}>{summary[state].map(partName).join(', ')}</Text>
          </View>
        ))
      )}

      <Button label={t('damage.allChecked')} onPress={() => save({ damageCheckedAt: new Date().toISOString() })} variant={vehicle.damageCheckedAt ? 'secondary' : 'primary'} />
      <Text style={styles.hint}>
        {vehicle.damageCheckedAt
          ? t('damage.checkedOn', { date: new Date(vehicle.damageCheckedAt).toLocaleDateString(i18n.language) })
          : t('damage.notChecked')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  body: { fontSize: fontSize.body, color: colors.text },
  title: { fontSize: fontSize.title, fontWeight: '600', color: colors.text },
  label: { fontSize: fontSize.small, fontWeight: '500', color: colors.text },
  group: { gap: space[1] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: space[1] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  option: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingHorizontal: space[2], borderWidth: 1, borderColor: colors.border, borderRadius: radius },
  optionOn: { borderColor: colors.accent, borderWidth: 2 },
  optionText: { flexShrink: 1, fontSize: fontSize.body, color: colors.text },
  optionTextOn: { color: colors.accent, fontWeight: '600' },
});
