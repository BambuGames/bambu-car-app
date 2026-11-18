import type { ListingText } from '../local/listings';
import { isStale } from './stale';

const text = (over: Partial<ListingText> = {}): ListingText => ({
  listingId: 'v1', language: 'de', titles: ['a', 'b', 'c'], title: 'a', description: 'd', model: 'm',
  generatedAt: '2026-11-19T10:00:00.000Z', edited: false, updatedAt: '2026-11-19T10:00:00.000Z', ...over,
});

test('a text is stale once the vehicle or the listing changed after it was generated', () => {
  const t = text({ generatedAt: '2026-11-19T10:00:00.000Z' });
  expect(isStale(t, '2026-11-19T09:00:00.000Z', null)).toBe(false);
  expect(isStale(t, '2026-11-19T11:00:00.000Z', null)).toBe(true);
  expect(isStale(t, '2026-11-19T09:00:00.000Z', '2026-11-19T10:30:00.000Z')).toBe(true);
});
