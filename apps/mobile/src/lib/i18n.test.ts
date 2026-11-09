import de from '../locales/de.json';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o)
    .flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
    .sort();

test('every locale has exactly the German keys', () => {
  expect(keys(tr)).toEqual(keys(de));
  expect(keys(en)).toEqual(keys(de));
});

test('the messages authErrorKey returns exist', () => {
  expect(keys(de)).toEqual(
    expect.arrayContaining(['auth.errors.invalidCredentials', 'auth.errors.codeExpired', 'auth.errors.generic', 'common.offline']),
  );
});
