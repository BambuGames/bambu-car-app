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

// Two steps: request a code by email, then enter it with the new password.
export default function ResetPassword() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const request = () => {
    const emailError = isValidEmail(email) ? undefined : t('auth.validation.email');
    setErrors({ email: emailError });
    if (emailError) return;
    run(async () => {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (requestError) throw requestError;
      setStep('confirm');
    });
  };

  const confirm = () => {
    const token = normalizeCode(code);
    const next = {
      email: isValidEmail(email) ? undefined : t('auth.validation.email'),
      code: token ? undefined : t('auth.validation.code'),
      password: passwordProblem(password) ? t('auth.validation.passwordTooShort') : undefined,
    };
    setErrors(next);
    if (!token || next.email || next.password) return;
    run(() =>
      // A native alert, because this screen is gone once the code has signed the person in.
      signInWithCode(supabase.auth, { email: email.trim(), token, type: 'recovery', password }, () =>
        Alert.alert(t('auth.passwordNotSaved.title'), t('auth.passwordNotSaved.body')),
      ),
    );
  };

  if (step === 'request') {
    return (
      <Screen>
        <Notice text={t('auth.resetPassword.hint')} />
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
        {error ? <Notice kind="error" text={error} /> : null}
        <Button label={t('auth.resetPassword.request')} onPress={request} loading={busy} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Notice text={t('auth.resetPassword.codeSent')} />
      <TextField
        label={t('auth.code')}
        value={code}
        onChangeText={setCode}
        error={errors.code}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      {/* Repeated here so iOS saves the new password under the email, not the code. */}
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
      <Button label={t('auth.resetPassword.submit')} onPress={confirm} loading={busy} />
    </Screen>
  );
}
