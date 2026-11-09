import { signInWithCode } from './codeSignIn';

const params = { email: 'new@bambu.test', token: '123456', type: 'invite' as const, password: 'a-long-password' };
const ok = { data: {}, error: null };
const failed = { data: {}, error: { message: 'Network request failed' } };

function fakeAuth(verify: unknown, ...updates: unknown[]) {
  return {
    verifyOtp: jest.fn(async () => verify),
    updateUser: jest.fn(async () => updates.shift() ?? ok),
  };
}

test('a password that cannot be saved after the code signed the person in is reported, not thrown', async () => {
  const auth = fakeAuth(ok, failed, failed);
  const notSaved = jest.fn();
  await expect(signInWithCode(auth as never, params, notSaved)).resolves.toBeUndefined();
  expect(notSaved).toHaveBeenCalledTimes(1);
});

test('one failed save is tried again', async () => {
  const auth = fakeAuth(ok, failed);
  const notSaved = jest.fn();
  await signInWithCode(auth as never, params, notSaved);
  expect(auth.updateUser).toHaveBeenCalledTimes(2);
  expect(notSaved).not.toHaveBeenCalled();
});

test('a wrong code is thrown for the screen to show and sets no password', async () => {
  const wrong = { data: {}, error: { code: 'otp_expired', message: 'expired' } };
  const auth = fakeAuth(wrong);
  const notSaved = jest.fn();
  await expect(signInWithCode(auth as never, params, notSaved)).rejects.toMatchObject({ code: 'otp_expired' });
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(notSaved).not.toHaveBeenCalled();
});

test('the same password as before counts as saved', async () => {
  const auth = fakeAuth(ok, { data: {}, error: { code: 'same_password', message: 'same' } });
  const notSaved = jest.fn();
  await signInWithCode(auth as never, { ...params, type: 'recovery' }, notSaved);
  expect(auth.updateUser).toHaveBeenCalledTimes(1);
  expect(notSaved).not.toHaveBeenCalled();
});
