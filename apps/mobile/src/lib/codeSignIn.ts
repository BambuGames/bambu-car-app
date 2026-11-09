// Invite and password reset: the 6-digit code from the email signs the person in, then their password is set.
import type { SupabaseClient } from '@supabase/supabase-js';

type Auth = Pick<SupabaseClient['auth'], 'verifyOtp' | 'updateUser'>;

// Verifying the code signs the person in, and the auth screens unmount right then. A password that cannot
// be saved even on a second try is reported through passwordNotSaved, which must not depend on the screen.
export async function signInWithCode(
  auth: Auth,
  { email, token, type, password }: { email: string; token: string; type: 'invite' | 'recovery'; password: string },
  passwordNotSaved: () => void,
): Promise<void> {
  const verified = await auth.verifyOtp({ email, token, type });
  if (verified.error) throw verified.error;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await auth.updateUser({ password });
    // A reset to the password the account already has leaves the person with the password they chose.
    if (!error || error.code === 'same_password') return;
  }
  passwordNotSaved();
}
