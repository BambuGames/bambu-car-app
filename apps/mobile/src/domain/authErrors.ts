// Turns a Supabase auth error into the i18n key of the message shown to the user.
export function authErrorKey(error: unknown): string {
  if (error instanceof TypeError) return 'common.offline';
  const { code, name } = (error ?? {}) as { code?: string; name?: string };
  if (name === 'AuthRetryableFetchError') return 'common.offline';
  if (code === 'invalid_credentials') return 'auth.errors.invalidCredentials';
  if (code === 'otp_expired') return 'auth.errors.codeExpired';
  return 'auth.errors.generic';
}
