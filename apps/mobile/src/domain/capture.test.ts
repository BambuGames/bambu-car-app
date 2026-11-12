import { photoFileName } from './capture';

test('photoFileName differs per capture time', () => {
  expect(photoFileName('v1', 'front', '2026-11-12T10:00:00.000Z')).toBe('v1/front-2026-11-12T10-00-00-000Z.jpg');
  expect(photoFileName('v1', 'front', '2026-11-12T10:00:01.000Z')).not.toBe(
    photoFileName('v1', 'front', '2026-11-12T10:00:00.000Z'),
  );
});
