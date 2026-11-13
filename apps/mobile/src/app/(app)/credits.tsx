// Credits (design 9): the balance, then every booking, newest first. Owner only; online only.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { entryLabel, fetchCredits, type CreditEntry } from '../../gallery/credits';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { colors, fontSize, space } from '../../ui/theme';

type Credits = { balance: number; entries: CreditEntry[] };

export default function CreditsScreen() {
  const { t, i18n } = useTranslation();
  const { membership } = useSession();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [failed, setFailed] = useState(false);
  const galleryId = membership?.galleryId;

  // Also the retry button's handler, so a retry does not hang on a dependency the compiler would drop.
  const load = useCallback(() => {
    if (!galleryId) return;
    let active = true;
    setFailed(false);
    fetchCredits(supabase, galleryId)
      .then((c) => active && setCredits(c))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [galleryId]);
  useFocusEffect(load);

  if (!credits) {
    return (
      <View style={styles.content}>
        {failed ? (
          <>
            <Notice kind="error" text={t('common.offline')} />
            <Button label={t('common.retry')} onPress={load} />
          </>
        ) : null}
      </View>
    );
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={credits.entries}
      keyExtractor={(e, i) => `${e.created_at}-${i}`}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.label}>{t('credits.available')}</Text>
          <Text style={styles.balance}>{credits.balance}</Text>
          <Text style={styles.hint}>{t('credits.hint')}</Text>
          <Text style={styles.heading} accessibilityRole="header">
            {t('credits.history')}
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.hint}>{t('credits.empty')}</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <View style={styles.entry}>
          <View style={styles.entryText}>
            <Text style={styles.entryLabel}>{entryLabel(item, t)}</Text>
            <Text style={styles.hint}>{[date(item.created_at), item.note].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={styles.amount}>{item.amount > 0 ? `+${item.amount}` : `−${-item.amount}`}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  header: { gap: space[1], marginBottom: space[2] },
  label: { fontSize: fontSize.small, color: colors.textMuted },
  balance: { fontSize: 44, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  heading: { fontSize: fontSize.body, fontWeight: '600', color: colors.text, marginTop: space[3] },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  entryText: { flex: 1, gap: space[0] },
  entryLabel: { fontSize: fontSize.body, color: colors.text },
  amount: { fontSize: fontSize.body, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
