import type { Membership } from './membership';

// Credits, gallery settings and staff belong to the gallery's owner (design 9).
export const canManageGallery = (m: Membership | null | undefined): boolean => m?.role === 'owner';

// M5: the processing that charges a vehicle's credit is the owner's; once it is paid, staff process it too.
export const ownerMustProcess = (m: Membership | null | undefined, creditChargedAt: string | null): boolean =>
  !canManageGallery(m) && creditChargedAt === null;
