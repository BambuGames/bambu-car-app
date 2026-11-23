import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authErrorKey } from '../../domain/authErrors';
import { isValidEmail } from '../../domain/validation';
import { legalLinks, openLegal } from '../../lib/legal';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { BrandHead } from '../../ui/BrandHead';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { colors, fontSize, space } from '../../ui/theme';

export default function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setEmailError(isValidEmail(email) ? null : t('auth.validation.email'));
    if (!isValidEmail(email)) return;
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) setError(t(authErrorKey(signInError)));
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BrandHead />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      {error ? <Notice kind="error" text={error} /> : null}
      <Button label={t('auth.signIn.submit')} onPress={submit} loading={busy} />
      <Button variant="secondary" label={t('auth.signIn.acceptInvite')} onPress={() => router.push('/accept-invite')} />
      <Button variant="secondary" label={t('auth.signIn.forgotPassword')} onPress={() => router.push('/reset-password')} />
      <View style={styles.legal}>
        {legalLinks().map((link) => (
          <Pressable key={link.key} accessibilityRole="link" hitSlop={space[2]} onPress={() => openLegal(link.url)}>
            <Text style={styles.legalText}>{t(`legal.${link.key}`)}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legal: { flexDirection: 'row', justifyContent: 'center', gap: space[4] },
  legalText: { fontSize: fontSize.small, color: colors.ink2, textDecorationLine: 'underline' },
});
