import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { uploadSummary } from '../../domain/progress';
import { EXTERIOR_SLOTS } from '../../domain/slots';
import { useSession } from '../../lib/session';
import { listVehicles, type VehicleListItem } from '../../local/vehicles';
import { useSync } from '../../sync/SyncProvider';
import { Button } from '../../ui/Button';
import { colors, fontSize, space } from '../../ui/theme';

export default function Vehicles() {
  const { t } = useTranslation();
  const { db, membership } = useSession();
  const { pending, failed, online, subscribe } = useSync();
  const [items, setItems] = useState<VehicleListItem[] | null>(null);

  // Load on focus, then again after every sync run while shown: pulled vehicles and finished uploads change the list.
  useFocusEffect(
    useCallback(() => {
      if (!db || !membership) return;
      let active = true;
      const load = () => listVehicles(db, membership.galleryId).then((list) => active && setItems(list));
      load();
      const unsubscribe = subscribe(load);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [db, membership, subscribe]),
  );

  const summary = uploadSummary({ pending, failed, online });

  if (!items) return null;
  return (
    <FlatList
      data={items}
      keyExtractor={(v) => v.id}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.header}>
          {summary ? <Text style={styles.summary}>{t(summary.key, { count: summary.count })}</Text> : null}
          <Button label={t('vehicles.new')} onPress={() => router.push('/vehicles/new')} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{t('vehicles.empty')}</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/vehicles/${item.id}`)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.name}>
            {item.make} {item.model}
          </Text>
          <Text style={styles.meta}>
            {[
              t(`vehicles.status.${item.status}`),
              t('vehicles.exteriorProgress', { done: item.exteriorDone, total: EXTERIOR_SLOTS.length }),
              item.pendingUploads > 0 ? t('vehicles.pendingUploads', { count: item.pendingUploads }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space[3] },
  header: { gap: space[2], paddingBottom: space[3] },
  summary: { fontSize: fontSize.small, color: colors.pending },
  empty: { fontSize: fontSize.body, color: colors.textMuted },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { paddingVertical: space[2], gap: space[0] },
  pressed: { opacity: 0.6 },
  name: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  meta: { fontSize: fontSize.small, color: colors.textMuted },
});
