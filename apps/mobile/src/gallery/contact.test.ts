import { normalizePhone, saveContact } from './contact';

test('normalizePhone keeps a valid number as typed and rejects junk', () => {
  expect(normalizePhone('  +49 30 1234567 ')).toBe('+49 30 1234567');
  expect(normalizePhone('')).toBeNull();
  expect(normalizePhone('   ')).toBeNull();
  expect(normalizePhone('12345')).toBe('invalid');
  expect(normalizePhone('030/123-45 67')).toBe('030/123-45 67');
  expect(normalizePhone('(030) 123456')).toBe('(030) 123456');
  expect(normalizePhone('+49 abc 123456')).toBe('invalid');
  expect(normalizePhone('1'.repeat(31))).toBe('invalid');
});

test('saveContact sends only the fields it is given', async () => {
  const update = jest.fn(() => ({ eq: () => ({ select: async () => ({ data: [{ id: 'g' }], error: null }) }) }));
  const client = { from: () => ({ update }) } as never;
  expect(await saveContact(client, 'g', { whatsapp: '123456' })).toBeUndefined();
  expect(update).toHaveBeenCalledWith({ whatsapp: '123456' });
});
