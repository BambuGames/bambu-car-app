// Before/after (design 2.1/5): a two-way switch, and holding the picture shows the original.
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Segmented } from '../ui/Segmented';
import { colors, radius, space } from '../ui/theme';

export type Picture = { url: string; path: string };

export function CompareImage({ before, after }: { before: Picture | null; after: Picture | null }) {
  const { t } = useTranslation();
  // Until staff pick a side, show the result as soon as it has loaded.
  const [picked, setSide] = useState<'before' | 'after' | null>(null);
  const side = picked ?? (after ? 'after' : 'before');
  const [holding, setHolding] = useState(false);
  const shown = holding || side === 'before' ? before : after;
  return (
    <View style={styles.wrap}>
      <Pressable onPressIn={() => setHolding(true)} onPressOut={() => setHolding(false)} accessibilityHint={t('studio.compareHint')}>
        <Image
          source={shown ? { uri: shown.url, cacheKey: shown.path } : undefined}
          style={styles.image}
          contentFit="contain"
          accessibilityLabel={t(holding || side === 'before' ? 'studio.before' : 'studio.after')}
        />
      </Pressable>
      <Segmented
        value={side}
        onChange={setSide}
        options={[
          { value: 'before', label: t('studio.before') },
          { value: 'after', label: t('studio.after'), disabled: !after },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.sheet },
});
