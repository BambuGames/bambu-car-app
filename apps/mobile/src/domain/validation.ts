export const isValidEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// Codes from the invite and reset mails: six digits, often pasted with spaces.
export function normalizeCode(s: string): string | null {
  const code = s.replace(/\s/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

// Same minimum as the server (supabase/config.toml: minimum_password_length = 8).
export const passwordProblem = (s: string): 'tooShort' | null => (s.length < 8 ? 'tooShort' : null);
