import { isValidEmail, normalizeCode, passwordProblem } from './validation';

test('isValidEmail accepts a normal address and rejects a broken one', () => {
  expect(isValidEmail('staff@bambu.test')).toBe(true);
  expect(isValidEmail('staff@')).toBe(false);
});

test('normalizeCode strips spaces and requires exactly six digits', () => {
  expect(normalizeCode(' 123 456 ')).toBe('123456');
  expect(normalizeCode('12345')).toBeNull();
  expect(normalizeCode('12a456')).toBeNull();
});

test('passwordProblem requires at least 8 characters', () => {
  expect(passwordProblem('1234567')).toBe('tooShort');
  expect(passwordProblem('12345678')).toBeNull();
});
