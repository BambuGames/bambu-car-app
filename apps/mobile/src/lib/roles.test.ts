import { canManageGallery } from './roles';

test('only owners manage the gallery', () => {
  expect(canManageGallery({ galleryId: 'g', galleryName: 'Autohaus', role: 'owner' })).toBe(true);
  expect(canManageGallery({ galleryId: 'g', galleryName: 'Autohaus', role: 'staff' })).toBe(false);
  expect(canManageGallery(null)).toBe(false);
  expect(canManageGallery(undefined)).toBe(false);
});
