import { authErrorKey } from './authErrors';

test('authErrorKey maps Supabase errors to messages', () => {
  expect(authErrorKey({ code: 'invalid_credentials' })).toBe('auth.errors.invalidCredentials');
  expect(authErrorKey({ code: 'otp_expired' })).toBe('auth.errors.codeExpired');
  expect(authErrorKey(new TypeError('Network request failed'))).toBe('common.offline');
  expect(authErrorKey({ code: 'something_else' })).toBe('auth.errors.generic');
});
