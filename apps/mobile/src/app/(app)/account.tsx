import * as Network from 'expo-network';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { authErrorKey } from '../../domain/authErrors';
import { legalLinks, openLegal } from '../../lib/legal';
import { canManageGallery } from '../../lib/roles';
import { useSession } from '../../lib/session';
import { pendingCount } from '../../local/outbox';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { Screen } from '../../ui/Screen';
import { NavGroup, NavRow } from '../../ui/NavRow';
import { colors, fonts, fontSize, space } from '../../ui/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function Account() {
  const { t } = useTranslation();
  const { user, membership, db, signOut, deleteAccount } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    setError(null);
    if (!(await Network.getNetworkStateAsync()).isConnected) {
      setError(t('account.deleteOffline'));
      return;
    }
    const pending = db ? await pendingCount(db) : 0;
    const body = [t('account.deleteBody'), pending > 0 ? t('account.deletePending', { count: pending }) : null]
      .filter(Boolean)
      .join('\n\n');
    Alert.alert(t('account.deleteTitle'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
          } catch (e) {
            setError(t(authErrorKey(e)));
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Row label={t('auth.email')} value={user?.email ?? ''} />
      {membership ? (
        <>
          <Row label={t('account.gallery')} value={membership.galleryName} />
          <Row label={t('account.role')} value={t(`account.roles.${membership.role}`)} />
        </>
      ) : null}
      {canManageGallery(membership) ? (
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {t('account.manage')}
          </Text>
          <NavGroup inset>
            <NavRow label={t('credits.title')} onPress={() => router.push('/credits')} />
            <NavRow label={t('gallerySettings.title')} onPress={() => router.push('/gallery/settings')} />
            <NavRow label={t('members.title')} onPress={() => router.push('/gallery/members')} last />
          </NavGroup>
        </View>
      ) : null}
      <NavGroup inset>
        <NavRow label={t('account.licenses')} onPress={() => router.push('/licenses')} />
        {legalLinks().map((link) => (
          <NavRow key={link.key} label={t(`legal.${link.key}`)} onPress={() => openLegal(link.url)} />
        ))}
        <NavRow label={t('account.signOut')} onPress={signOut} last />
      </NavGroup>
      <Button variant="danger" label={t('account.delete')} onPress={confirmDelete} loading={busy} />
      {error ? <Notice kind="error" text={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[0] },
  label: { fontSize: fontSize.small, color: colors.ink2 },
  value: { fontSize: fontSize.body, color: colors.ink },
  section: { gap: space[2] },
  heading: { fontFamily: fonts.title, fontSize: fontSize.title, color: colors.ink, marginTop: space[2] },
});
