import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, space } from './theme';
import { Wordmark } from './Wordmark';

// The top of the sign-in, invite and reset screens: the product name and what it does, in one line.
export function BrandHead() {
  const { t } = useTranslation();
  return (
    <View style={styles.head}>
      <Wordmark size={28} />
      <Text style={styles.tagline}>{t('auth.tagline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space[1], paddingTop: space[2], paddingBottom: space[3] },
  tagline: { fontSize: fontSize.body, lineHeight: 22, color: colors.ink2 },
});
