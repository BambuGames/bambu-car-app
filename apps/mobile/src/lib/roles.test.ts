import { canManageGallery, ownerMustProcess } from './roles';

test('only owners manage the gallery', () => {
  expect(canManageGallery({ galleryId: 'g', galleryName: 'Autohaus', role: 'owner' })).toBe(true);
  expect(canManageGallery({ galleryId: 'g', galleryName: 'Autohaus', role: 'staff' })).toBe(false);
  expect(canManageGallery(null)).toBe(false);
  expect(canManageGallery(undefined)).toBe(false);
});

// M5: only the owner starts the processing that charges a credit.
const staff = { galleryId: 'g', galleryName: 'Autohaus', role: 'staff' } as const;
const owner = { galleryId: 'g', galleryName: 'Autohaus', role: 'owner' } as const;

test('staff leave a vehicle that is not paid yet to the owner', () => {
  expect(ownerMustProcess(staff, null)).toBe(true);
  expect(ownerMustProcess(null, null)).toBe(true);
});

test('a paid vehicle, or the owner, can be processed', () => {
  expect(ownerMustProcess(staff, '2026-11-19T10:00:00Z')).toBe(false);
  expect(ownerMustProcess(owner, null)).toBe(false);
});
