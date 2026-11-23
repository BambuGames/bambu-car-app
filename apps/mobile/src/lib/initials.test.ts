import { initials } from './initials';

test('two words give their first letters', () => {
  expect(initials('Autohaus Müller')).toBe('AM');
});

test('one word gives its first two letters', () => {
  expect(initials('Testgalerie')).toBe('TE');
});

test('extra spaces and an empty name are handled', () => {
  expect(initials('  autohaus   am  ring ')).toBe('AA');
  expect(initials('')).toBe('');
});
