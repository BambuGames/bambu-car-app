import type { ListingText } from '../local/listings';
import { isShareCancel, plateWarning, shareMessage, shareReadiness } from './shareSet';
import type { PosterModel } from './posterModel';

const model: PosterModel = { title: 'Opel Crossland', facts: ['07/2024', '45.004 km'], price: '17.990 €', priceNote: null, location: null, contact: null };
const text = (p: Partial<ListingText>): ListingText => ({
  listingId: 'v', language: 'de', titles: [], title: '', description: '', model: 'm', generatedAt: '', edited: false, updatedAt: '', ...p,
});

test('shareMessage uses the listing text when there is one', () => {
  expect(shareMessage(text({ title: 'T', description: 'D' }), model)).toBe('T\n\nD');
});
test('shareMessage falls back to title, facts and price', () => {
  expect(shareMessage(null, model)).toBe('Opel Crossland\n07/2024 · 45.004 km\n17.990 €');
});
test('shareReadiness reports offline and no-processed-photo', () => {
  expect(shareReadiness({ online: false, hasProcessedPhoto: true })).toBe('offline');
  expect(shareReadiness({ online: true, hasProcessedPhoto: false })).toBe('no_photos');
  expect(shareReadiness({ online: true, hasProcessedPhoto: true })).toBe('ok');
});
test('isShareCancel recognises a dismissed share sheet', () => {
  expect(isShareCancel(new Error('User did not share'))).toBe(true);
  expect(isShareCancel(new Error('network'))).toBe(false);
  expect(isShareCancel('User did not share')).toBe(false);
});
test('shareMessage skips the facts line when there are none', () => {
  expect(shareMessage(null, { ...model, facts: [] })).toBe('Opel Crossland\n17.990 €');
});
test('plateWarning: no banner, or a plate that is not confirmed, can reach the post', () => {
  expect(plateWarning(false, [{ plate_status: 'none' }])).toBe('no_banner');
  expect(plateWarning(true, [{ plate_status: 'confirmed' }, { plate_status: 'none' }, { plate_status: null }])).toBeNull();
  expect(plateWarning(true, [{ plate_status: 'confirmed' }, { plate_status: 'auto' }])).toBe('check');
  expect(plateWarning(true, [{ plate_status: 'needs_check' }])).toBe('check');
  expect(plateWarning(true, [])).toBeNull();
});
