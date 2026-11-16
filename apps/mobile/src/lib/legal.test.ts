import { legalLinks } from './legal';

test('without the release variables there are no legal links', () => {
  expect(legalLinks()).toEqual([]);
  expect(legalLinks({})).toEqual([]);
});

test('lists privacy and imprint in that order, skipping an empty one', () => {
  const privacy = 'https://bambugames.example/datenschutz';
  const imprint = 'https://bambugames.example/impressum';
  expect(legalLinks({ privacy, imprint })).toEqual([
    { key: 'privacy', url: privacy },
    { key: 'imprint', url: imprint },
  ]);
  expect(legalLinks({ privacy: '', imprint }).map((l) => l.key)).toEqual(['imprint']);
});
