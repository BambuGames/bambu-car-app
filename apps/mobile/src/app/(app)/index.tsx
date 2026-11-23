import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { uploadSummary } from '../../domain/progress';
import { useSession } from '../../lib/session';
import { listVehicles, type VehicleListItem } from '../../local/vehicles';
import { useCovers } from '../../studio/useCovers';
import { useSync } from '../../sync/SyncProvider';
import { Button } from '../../ui/Button';
import { Fact } from '../../ui/Fact';
import { Icon } from '../../ui/Icon';
import { StateLine } from '../../ui/StateLine';
import { colors, fonts, fontSize, maxScale, radiusPhoto, space } from '../../ui/theme';
import { listFacts, localeFor } from '../../vehicle/facts';
import { stateLine } from '../../vehicle/stateLine';

// The fleet, read like a stack of registration certificates: photo, name, coded facts, one state line.
export default function Vehicles() {
  const { t, i18n } = useTranslation();
  const { db, membership } = useSession();
  const { pending, failed, online, subscribe } = useSync();
  const [items, setItems] = useState<VehicleListItem[] | null>(null);
  const covers = useCovers(membership?.galleryId);

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
  const locale = localeFor(i18n.language);

  if (!items) return null;
  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(v) => v.id}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} maxFontSizeMultiplier={maxScale.display} accessibilityRole="header">
            {t('vehicles.title')}
          </Text>
          {summary ? <Text style={styles.summary}>{t(summary.key, { count: summary.count })}</Text> : null}
          <Button label={t('vehicles.new')} onPress={() => router.push('/vehicles/new')} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{t('vehicles.empty')}</Text>}
      renderItem={({ item, index }) => {
        const cover = covers[item.id];
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/vehicles/${item.id}`)}
            style={({ pressed }) => [styles.row, index === 0 && styles.first, pressed && styles.pressed]}
          >
            {cover ? (
              <Image source={{ uri: cover.url, cacheKey: cover.path }} style={styles.photo} contentFit="cover" accessible={false} />
            ) : (
              <View style={[styles.photo, styles.noPhoto]}>
                <Icon ios="car.side" android="directions_car" size={28} color={colors.field} />
              </View>
            )}
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={maxScale.display}>
                {item.make} {item.model}
              </Text>
              {listFacts(item.data, locale).length > 0 ? (
                <View style={styles.facts}>
                  {listFacts(item.data, locale).map((f) => (
                    <Fact key={f.code} code={f.code} value={f.value} />
                  ))}
                </View>
              ) : null}
              <StateLine state={stateLine(item)} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { paddingBottom: space[5] },
  header: { gap: space[2], paddingHorizontal: space[3], paddingTop: space[1], paddingBottom: space[3] },
  title: { fontFamily: fonts.display, fontSize: fontSize.display, lineHeight: 40, color: colors.ink, paddingBottom: space[1] },
  summary: { fontSize: fontSize.small, color: colors.wait },
  empty: { fontSize: fontSize.body, color: colors.ink2, paddingHorizontal: space[3] },
  row: {
    flexDirection: 'row',
    gap: space[2] + 2,
    paddingHorizontal: space[3],
    paddingVertical: space[2] + 2,
    backgroundColor: colors.sheet,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
  },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  pressed: { backgroundColor: colors.paper },
  photo: { width: 116, height: 87, borderRadius: radiusPhoto, backgroundColor: colors.paper },
  noPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.field },
  text: { flex: 1, gap: space[1] + 1 },
  name: { fontFamily: fonts.title, fontSize: 18, lineHeight: 22, color: colors.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[2], rowGap: space[1] },
});
