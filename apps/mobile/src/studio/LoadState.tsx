// What a studio screen shows before its data is there: loading, offline, or a failed load with a retry.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { colors, space } from '../ui/theme';

export function StudioLoadState({ error, online, onRetry }: { error: string | null; online: boolean; onRetry: () => Promise<void> }) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const text = online ? t(error ? 'studio.loadFailed' : 'studio.loading') : t('studio.blocked.offline');

  const retry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <View style={styles.content}>
      <Notice kind={error ? 'error' : 'info'} text={text} />
      {error ? <Button variant="secondary" label={t('studio.retry')} onPress={retry} loading={retrying} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
});
