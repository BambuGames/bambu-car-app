import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DETAIL_SLOTS, EXTERIOR_SLOTS, INTERIOR_SLOTS, type Slot } from '../../../../domain/slots';
import type { Vehicle } from '../../../../domain/vehicle';
import { useSession } from '../../../../lib/session';
import { listPhotos, type PhotoRow } from '../../../../local/photos';
import { getListing, type Listing } from '../../../../local/listings';
import { getVehicle } from '../../../../local/vehicles';
import { useCovers } from '../../../../studio/useCovers';
import { useSync } from '../../../../sync/SyncProvider';
import { Button } from '../../../../ui/Button';
import { Fact } from '../../../../ui/Fact';
import { Icon } from '../../../../ui/Icon';
import { NavGroup, NavRow } from '../../../../ui/NavRow';
import { Notice } from '../../../../ui/Notice';
import { StateLine } from '../../../../ui/StateLine';
import { colors, fonts, fontSize, maxScale, space } from '../../../../ui/theme';
import { localeFor, pageFacts } from '../../../../vehicle/facts';
import { sectionProgress } from '../../../../vehicle/sections';
import { stateLine } from '../../../../vehicle/stateLine';

const SECTIONS: { key: 'exterior' | 'details' | 'interior'; slots: readonly Slot[] }[] = [
  { key: 'exterior', slots: EXTERIOR_SLOTS },
  { key: 'details', slots: DETAIL_SLOTS },
  { key: 'interior', slots: INTERIOR_SLOTS },
];

// Shot list of one vehicle. Tapping a step opens the camera on that step.
export default function VehicleScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, membership } = useSession();
  const covers = useCovers(membership?.galleryId);
  const { subscribe } = useSync();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [listing, setListing] = useState<Listing | null>(null);

  // Load on focus, then again after every sync run while shown: pulled photos and finished uploads change the states.
  useFocusEffect(
    useCallback(() => {
      if (!db || !id) return;
      let active = true;
      const load = () =>
        Promise.all([getVehicle(db, id), listPhotos(db, id), getListing(db, id)]).then(([v, p, l]) => {
          if (!active) return;
          setVehicle(v);
          setPhotos(p);
          setListing(l);
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
      <View style={styles.missing}>
        <Notice text={t('vehicle.notFound')} />
      </View>
    );
  }

  const bySlot = new Map(photos.map((p) => [p.slot, p]));
  const uploaded = photos.some((p) => p.uploadState === 'uploaded' || p.uploadState === 'remote');
  const exteriorDone = photos.filter((p) => (EXTERIOR_SLOTS as readonly Slot[]).includes(p.slot)).length;
  const pendingUploads = photos.filter((p) => ['pending', 'uploading', 'failed'].includes(p.uploadState)).length;
  const cover = covers[vehicle.id];
  const open = (pathname: '/vehicles/[id]/data' | '/vehicles/[id]/damage' | '/vehicles/[id]/listing' | '/vehicles/[id]/report' | '/vehicles/[id]/share') =>
    router.push({ pathname, params: { id: vehicle.id } });
  const actions: { label: string; state?: string; onPress: () => void }[] = [
    { label: t('vehicleData.title'), state: t('vehicleData.progress', sectionProgress(vehicle, listing)), onPress: () => open('/vehicles/[id]/data') },
    { label: t('damage.title'), state: vehicle.damageCheckedAt ? t('damage.checked') : t('damage.notChecked'), onPress: () => open('/vehicles/[id]/damage') },
    { label: t('listing.title'), onPress: () => open('/vehicles/[id]/listing') },
    { label: t('report.title'), onPress: () => open('/vehicles/[id]/report') },
    { label: t('share.title'), onPress: () => open('/vehicles/[id]/share') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: '' }} />
      {cover ? (
        <Image source={{ uri: cover.url, cacheKey: cover.path }} style={styles.hero} contentFit="cover" accessible={false} />
      ) : (
        <View style={[styles.hero, styles.noHero]}>
          <Icon ios="car.side" android="directions_car" size={44} color={colors.field} />
        </View>
      )}
      <View style={styles.head}>
        <Text style={styles.name} maxFontSizeMultiplier={maxScale.display} accessibilityRole="header">
          {vehicle.make} {vehicle.model}
        </Text>
        <View style={styles.facts}>
          <Text style={styles.body}>{t(`bodyTypes.${vehicle.bodyType}`)}</Text>
          {pageFacts(vehicle.data, localeFor(i18n.language), (f) => t(`vehicleData.values.FUELS.${f}`)).map((f) => (
            <Fact key={f.code} code={f.code} value={f.value} />
          ))}
        </View>
        <StateLine state={stateLine({ status: vehicle.status, exteriorDone, pendingUploads })} />
      </View>
      <View style={styles.block}>
        <Button
          label={t('studio.open')}
          onPress={() => router.push({ pathname: '/vehicles/[id]/studio', params: { id: vehicle.id } })}
          disabled={!uploaded}
        />
        {!uploaded && photos.length > 0 ? <Text style={styles.note}>{t('studio.needsUpload')}</Text> : null}
      </View>
      <NavGroup>
        {actions.map((a, i) => (
          <NavRow key={a.label} label={a.label} state={a.state} onPress={a.onPress} last={i === actions.length - 1} />
        ))}
      </NavGroup>
      {SECTIONS.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t(`vehicle.${section.key}`)}
          </Text>
          <NavGroup>
            {section.slots.map((slot, i) => {
              const state = bySlot.get(slot)?.uploadState ?? 'missing';
              // A missing exterior angle is the next step; missing details and interior shots are optional.
              const needed = state === 'failed' || (state === 'missing' && section.key === 'exterior');
              return (
                <NavRow
                  key={slot}
                  label={t(`slots.${slot}`)}
                  state={t(`photoState.${state}`)}
                  stateTone={needed ? 'mark' : 'normal'}
                  onPress={() => router.push({ pathname: '/vehicles/[id]/capture', params: { id: vehicle.id, slot } })}
                  last={i === section.slots.length - 1}
                />
              );
            })}
          </NavGroup>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { paddingBottom: space[5], gap: space[4] },
  missing: { padding: space[3] },
  hero: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.sheet },
  noHero: { aspectRatio: undefined, height: 160, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: space[3], gap: space[2] },
  body: { fontSize: fontSize.small, color: colors.ink2 },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[3], rowGap: space[1] },
  block: { paddingHorizontal: space[3], gap: space[2] },
  note: { fontSize: fontSize.small, color: colors.ink2 },
  section: { gap: space[2] },
  sectionTitle: { fontFamily: fonts.title, fontSize: fontSize.title, color: colors.ink, paddingHorizontal: space[3] },
});
