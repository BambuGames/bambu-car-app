// Touch-up of one processed photo (design 7.3): saves the edits and re-renders that photo from its stored
// mask, without a new background-removal call.
import { Skia, type SkImage } from '@shopify/react-native-skia';
import * as Network from 'expo-network';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { processErrorOf, saveAndRender, type ProcessError } from '../../../../studio/api';
import type { Picture } from '../../../../studio/CompareImage';
import type { MaskEdit } from '../../../../studio/status';
import { TouchUpEditor } from '../../../../studio/TouchUpEditor';
import { studioApi, useStudio } from '../../../../studio/useStudio';
import { Notice } from '../../../../ui/Notice';
import { colors, space } from '../../../../ui/theme';

export default function TouchUpScreen() {
  const { t } = useTranslation();
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const { data } = useStudio(id);
  const network = Network.useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const photo = data?.photos.find((p) => p.id === photoId) ?? null;
  const output = photo?.output_path ?? null;
  const [image, setImage] = useState<Picture | null>(null);
  const [error, setError] = useState<ProcessError | null>(null);
  const maskPath = photo?.mask_path ?? null;
  const [mask, setMask] = useState<SkImage | null>(null);

  useEffect(() => {
    if (!output) return;
    let active = true;
    studioApi
      .signedUrls('processed', [output])
      .then((urls) => active && urls[output] && setImage({ url: urls[output], path: output }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [output]);

  // The car mask, so the editor can tell a part joined to the car from one apart (design 7.2.3). A failed
  // download leaves it null and the editor accepts every tap, as before.
  useEffect(() => {
    if (!maskPath) return;
    let active = true;
    studioApi
      .signedUrls('processed', [maskPath])
      .then((urls) => (urls[maskPath] ? Skia.Data.fromURI(urls[maskPath]) : null))
      .then((data) => {
        if (active && data) setMask(Skia.Image.MakeImageFromEncoded(data));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [maskPath]);

  // True once the edits are stored and the photo is queued; the editor then leaves. When it cannot be queued
  // the row keeps its earlier edits, so "Verwerfen" really leaves it unchanged.
  const save = async (edits: MaskEdit[]) => {
    setError(null);
    try {
      await saveAndRender(studioApi, { vehicleId: id, photoId, edits, previous: photo?.mask_edits ?? [] });
      return true;
    } catch (e) {
      setError(processErrorOf(e, online));
      return false;
    }
  };

  return (
    // Not scrollable: one finger paints. The insets keep the photo below the iOS 26 header, which content runs under.
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" scrollEnabled={false}>
      {/* iOS 26 takes any drag to the right as "back"; the header's back button stays, behind the leave guard. */}
      <Stack.Screen options={{ title: t('touchUp.title'), gestureEnabled: false }} />
      {photo?.placement && image ? (
        <TouchUpEditor image={image} mask={mask} placement={photo.placement} edits={photo.mask_edits} canSave={online} onSave={save} />
      ) : null}
      {!online ? <Notice text={t('studio.blocked.offline')} /> : null}
      {error ? <Notice kind="error" text={t(`studio.errors.${error}`)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space[3], gap: space[3], backgroundColor: colors.background },
});
