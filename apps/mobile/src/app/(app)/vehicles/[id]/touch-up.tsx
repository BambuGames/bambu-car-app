// Touch-up of one processed photo (design 7.3): saves the edits and re-renders that photo from its stored
// mask, without a new background-removal call.
import * as Network from 'expo-network';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { ProcessError } from '../../../../studio/api';
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

  // True once the edits are stored and the photo is queued; the editor then leaves.
  const save = async (edits: MaskEdit[]) => {
    setError(null);
    try {
      await studioApi.saveMaskEdits(photoId, edits);
    } catch {
      setError(online ? 'internal' : 'offline');
      return false;
    }
    const result = await studioApi.startProcessing({ vehicleId: id, photoId });
    if ('error' in result) setError(result.error);
    return !('error' in result);
  };

  return (
    <View style={styles.content}>
      <Stack.Screen options={{ title: t('touchUp.title') }} />
      {photo?.placement && image ? (
        <TouchUpEditor image={image} placement={photo.placement} edits={photo.mask_edits} canSave={online} onSave={save} />
      ) : null}
      {!online ? <Notice text={t('studio.blocked.offline')} /> : null}
      {error ? <Notice kind="error" text={t(`studio.errors.${error}`)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: space[3], gap: space[3], backgroundColor: colors.background },
});
