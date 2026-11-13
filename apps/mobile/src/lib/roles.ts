import type { Membership } from './membership';

// Credits, gallery settings and staff belong to the gallery's owner (design 9).
export const canManageGallery = (m: Membership | null | undefined): boolean => m?.role === 'owner';
