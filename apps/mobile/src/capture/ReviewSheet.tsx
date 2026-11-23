// Shown after a photo only when the quality check found something (design 6.4): retake, or keep it anyway.
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { QcIssue } from '../domain/capture';
import { Button } from '../ui/Button';
import { colors, fonts, fontSize, radius, space } from '../ui/theme';

export function ReviewSheet({
  uri,
  issues,
  onRetake,
  onUse,
}: {
  uri: string;
  issues: QcIssue[];
  onRetake: () => void;
  onUse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Image source={{ uri }} style={styles.photo} resizeMode="contain" />
        <View style={styles.side}>
          <Text style={styles.title} accessibilityRole="header">
            {t('capture.qc.title')}
          </Text>
          {issues.map((issue) => (
            <Text key={issue} style={styles.issue}>
              {t(`capture.qc.${issue}`)}
            </Text>
          ))}
          <View style={styles.actions}>
            <Button label={t('capture.qc.retake')} onPress={onRetake} />
            <Button label={t('capture.qc.useAnyway')} variant="secondary" onPress={onUse} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: space[4] },
  sheet: { flexDirection: 'row', gap: space[4], backgroundColor: colors.paper, borderRadius: radius, padding: space[3] },
  photo: { flex: 3, aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.sheet },
  side: { flex: 2, gap: space[2] },
  title: { fontFamily: fonts.title, fontSize: fontSize.title, color: colors.ink },
  issue: { fontSize: fontSize.body, color: colors.mark },
  actions: { marginTop: 'auto', gap: space[2] },
});
