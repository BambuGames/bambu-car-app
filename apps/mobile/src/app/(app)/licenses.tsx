// Credits the licences ask for: the 3D models behind the templates (CC BY) and the vehicle detector.
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { TEMPLATE_CREDITS } from '../../templates/templates.generated';
import { Screen } from '../../ui/Screen';
import { colors, fontSize, space } from '../../ui/theme';

type Credit = { model: string; author: string; license: string; link: string };

// The licence texts both licences ask to point to.
const LICENSE_LINKS: Record<string, string> = {
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
};

const DETECTOR: Credit = {
  model: 'EfficientDet-Lite0, EfficientDet-Lite2',
  author: 'The TensorFlow Authors',
  license: 'Apache-2.0',
  link: 'https://github.com/google/automl/tree/master/efficientdet',
};

// Number plate detection on the processing server (M0 Task 4): weights and their training data.
const PLATE: Credit[] = [
  {
    model: 'RT-DETRv2 License Plate Detection',
    author: 'justjuu',
    license: 'Apache-2.0',
    link: 'https://huggingface.co/justjuu/rtdetr-v2-license-plate-detection',
  },
  {
    model: 'License Plate Detection Dataset',
    author: 'justjuu',
    license: 'CC BY 4.0',
    link: 'https://huggingface.co/datasets/justjuu/license-plate-detection',
  },
];

function Link({ url, label }: { url: string; label?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)}>
      <Text style={styles.link}>{label ?? url}</Text>
    </Pressable>
  );
}

function Entry({ credit, note }: { credit: Credit; note?: string }) {
  const { t } = useTranslation();
  const licenseLink = LICENSE_LINKS[credit.license];
  return (
    <View style={styles.entry}>
      <Text style={styles.model}>{credit.model}</Text>
      <Text style={styles.meta}>{t('licenses.by', { author: credit.author })}</Text>
      {note ? <Text style={styles.meta}>{note}</Text> : null}
      <Link url={credit.link} />
      {licenseLink ? <Link url={licenseLink} label={t('licenses.license', { license: credit.license })} /> : null}
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
        <Entry key={c.bodyType} credit={c} note={t('licenses.adapted')} />
      ))}
      <Text style={styles.section} accessibilityRole="header">
        {t('licenses.detector')}
      </Text>
      <Entry credit={DETECTOR} />
      <Text style={styles.section} accessibilityRole="header">
        {t('licenses.plate')}
      </Text>
      {PLATE.map((c) => (
        <Entry key={c.link} credit={c} />
      ))}
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
