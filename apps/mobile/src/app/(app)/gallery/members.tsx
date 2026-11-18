// Staff (design 9): who has access to the gallery, inviting someone by email, and removing staff. Owner only,
// online only. Removing ends the person's access to this gallery; their account stays.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { inviteMember, listMembers, removeMember, type Member, type MemberError } from '../../../gallery/members';
import { useSession } from '../../../lib/session';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/Notice';
import { TextField } from '../../../ui/TextField';
import { colors, fontSize, space } from '../../../ui/theme';

export default function MembersScreen() {
  const { t } = useTranslation();
  const { membership } = useSession();
  const galleryId = membership?.galleryId;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [failed, setFailed] = useState<MemberError | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    if (!galleryId) return;
    let active = true;
    setFailed(null);
    listMembers(supabase, galleryId).then((r) => {
      if (!active) return;
      if ('error' in r) setFailed(r.error);
      else setMembers(r.members);
    });
    return () => {
      active = false;
    };
  }, [galleryId]);
  useFocusEffect(load);

  if (!galleryId) return null;

  const invite = async () => {
    const address = email.trim();
    if (busy || address === '') return; // Enter in the field bypasses the button's loading state
    setBusy(true);
    setResult(null);
    const r = await inviteMember(supabase, galleryId, address);
    setBusy(false);
    if ('error' in r) {
      setResult({ kind: 'error', text: t(`members.errors.${r.error}`) });
      return;
    }
    setEmail('');
    setResult({ kind: 'info', text: t(r.invited ? 'members.invited' : 'members.added', { email: address }) });
    load();
  };

  const confirmRemove = (m: Member) =>
    Alert.alert(t('members.removeTitle', { email: m.email ?? '' }), t('members.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('members.remove'),
        style: 'destructive',
        onPress: async () => {
          const r = await removeMember(supabase, galleryId, m.userId);
          setResult('error' in r ? { kind: 'error', text: t(`members.errors.${r.error}`) } : null);
          load();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="off"
        returnKeyType="send"
        onSubmitEditing={invite}
      />
      <Button label={t('members.invite')} onPress={invite} loading={busy} disabled={email.trim() === ''} />
      <Text style={styles.hint}>{t('members.inviteHint')}</Text>
      {result ? <Notice kind={result.kind} text={result.text} /> : null}

      <Text style={styles.heading} accessibilityRole="header">
        {t('members.title')}
      </Text>
      {failed ? (
        <>
          <Notice kind="error" text={t(`members.errors.${failed}`)} />
          <Button variant="secondary" label={t('common.retry')} onPress={load} />
        </>
      ) : null}
      {(members ?? []).map((m) => (
        <View key={m.userId} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.email} numberOfLines={1}>
              {m.email ?? '—'}
            </Text>
            <Text style={styles.hint}>
              {t(`account.roles.${m.role}`)}
              {m.confirmed ? '' : ' · '}
              {m.confirmed ? null : <Text style={styles.pending}>{t('members.pending')}</Text>}
            </Text>
          </View>
          {m.role === 'staff' ? <Button variant="danger" label={t('members.remove')} onPress={() => confirmRemove(m)} /> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], backgroundColor: colors.background },
  heading: { fontSize: fontSize.body, fontWeight: '600', color: colors.text, marginTop: space[3] },
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[1], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: space[0] },
  email: { fontSize: fontSize.body, color: colors.text },
  pending: { color: colors.pending, fontWeight: '600' },
});
