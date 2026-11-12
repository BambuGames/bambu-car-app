import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { missingExterior } from '../../../../domain/progress';
import { DETAIL_SLOTS, EXTERIOR_SLOTS, INTERIOR_SLOTS, type Slot } from '../../../../domain/slots';
import type { Vehicle } from '../../../../domain/vehicle';
import { useSession } from '../../../../lib/session';
import { listPhotos, type PhotoRow } from '../../../../local/photos';
import { getVehicle } from '../../../../local/vehicles';
import { useSync } from '../../../../sync/SyncProvider';
import { Notice } from '../../../../ui/Notice';
import { colors, fontSize, space } from '../../../../ui/theme';

const SECTIONS: { key: 'exterior' | 'details' | 'interior'; slots: readonly Slot[] }[] = [
  { key: 'exterior', slots: EXTERIOR_SLOTS },
  { key: 'details', slots: DETAIL_SLOTS },
  { key: 'interior', slots: INTERIOR_SLOTS },
];

// Shot list of one vehicle. Tapping a step opens the camera on that step.
export default function VehicleScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db } = useSession();
  const { subscribe } = useSync();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);

  // Load on focus, then again after every sync run while shown: pulled photos and finished uploads change the states.
  useFocusEffect(
    useCallback(() => {
      if (!db || !id) return;
      let active = true;
      const load = () =>
        Promise.all([getVehicle(db, id), listPhotos(db, id)]).then(([v, p]) => {
          if (!active) return;
          setVehicle(v);
          setPhotos(p);
        });
      load();
      const unsubscribe = subscribe(load);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [db, id, subscribe]),
  );

  if (vehicle === undefined) return null;
  if (vehicle === null) {
    return (
      <View style={styles.content}>
        <Notice text={t('vehicle.notFound')} />
      </View>
    );
  }

  const bySlot = new Map(photos.map((p) => [p.slot, p]));
  const missing = missingExterior(photos).length;

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: `${vehicle.make} ${vehicle.model}` }} />
      <Text style={styles.meta}>
        {t(`bodyTypes.${vehicle.bodyType}`)} · {t(`vehicles.status.${vehicle.status}`)}
      </Text>
      <Text style={styles.summary}>
        {missing > 0 ? t('vehicle.missingExterior', { count: missing }) : t('vehicle.exteriorComplete')}
      </Text>
      {SECTIONS.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t(`vehicle.${section.key}`)}
          </Text>
          {section.slots.map((slot) => {
            const state = bySlot.get(slot)?.uploadState ?? 'missing';
            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/vehicles/[id]/capture', params: { id: vehicle.id, slot } })}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.slot}>{t(`slots.${slot}`)}</Text>
                <Text style={[styles.state, state === 'failed' && styles.failed]}>{t(`photoState.${state}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3] },
  meta: { fontSize: fontSize.small, color: colors.textMuted },
  summary: { fontSize: fontSize.body, color: colors.text },
  section: { gap: space[1] },
  sectionTitle: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slot: { flexShrink: 1, fontSize: fontSize.body, color: colors.text },
  state: { fontSize: fontSize.small, color: colors.textMuted, textAlign: 'right' },
  failed: { color: colors.danger },
  pressed: { backgroundColor: colors.surface },
});
