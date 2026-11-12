// Credits the licences ask for: the 3D models behind the templates (CC BY) and the vehicle detector.
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { TEMPLATE_CREDITS } from '../../templates/templates.generated';
import { Screen } from '../../ui/Screen';
import { colors, fontSize, space } from '../../ui/theme';

type Credit = { model: string; author: string; license: string; link: string };

const DETECTOR: Credit = {
  model: 'EfficientDet-Lite0, EfficientDet-Lite2',
  author: 'The TensorFlow Authors',
  license: 'Apache-2.0',
  link: 'https://github.com/google/automl/tree/master/efficientdet',
};

function Entry({ credit }: { credit: Credit }) {
  const { t } = useTranslation();
  return (
    <View style={styles.entry}>
      <Text style={styles.model}>{credit.model}</Text>
      <Text style={styles.meta}>{t('licenses.by', { author: credit.author, license: credit.license })}</Text>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(credit.link)}>
        <Text style={styles.link}>{credit.link}</Text>
      </Pressable>
    </View>
  );
}

export default function Licenses() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text style={styles.section} accessibilityRole="header">
        {t('licenses.templates')}
      </Text>
      {TEMPLATE_CREDITS.map((c) => (
        <Entry key={c.bodyType} credit={c} />
      ))}
      <Text style={styles.section} accessibilityRole="header">
        {t('licenses.detector')}
      </Text>
      <Entry credit={DETECTOR} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: fontSize.body, fontWeight: '600', color: colors.text, marginTop: space[2] },
  entry: { gap: space[0] },
  model: { fontSize: fontSize.body, color: colors.text },
  meta: { fontSize: fontSize.small, color: colors.textMuted },
  link: { fontSize: fontSize.small, color: colors.text, textDecorationLine: 'underline' },
});
