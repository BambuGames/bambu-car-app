import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { authErrorKey } from '../../domain/authErrors';
import { isValidEmail, normalizeCode, passwordProblem } from '../../domain/validation';
import { signInWithCode } from '../../lib/codeSignIn';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';

// The invite mail carries a 6-digit code; verifying it signs the user in, then the password is set.
export default function AcceptInvite() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const token = normalizeCode(code);
    const next = {
      email: isValidEmail(email) ? undefined : t('auth.validation.email'),
      code: token ? undefined : t('auth.validation.code'),
      password: passwordProblem(password) ? t('auth.validation.passwordTooShort') : undefined,
    };
    setErrors(next);
    if (!token || next.email || next.password) return;
    setBusy(true);
    try {
      // A native alert, because this screen is gone once the code has signed the person in.
      await signInWithCode(supabase.auth, { email: email.trim(), token, type: 'invite', password }, () =>
        Alert.alert(t('auth.passwordNotSaved.title'), t('auth.passwordNotSaved.body')),
      );
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Notice text={t('auth.acceptInvite.hint')} />
      <TextField
        label={t('auth.code')}
        value={code}
        onChangeText={setCode}
        error={errors.code}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      {/* iOS saves the new password under the field right above it, so the email sits there. */}
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <TextField
        label={t('auth.newPassword')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? <Notice kind="error" text={error} /> : null}
      <Button label={t('auth.acceptInvite.submit')} onPress={submit} loading={busy} />
    </Screen>
  );
}
