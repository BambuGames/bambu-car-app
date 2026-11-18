import type { Vehicle } from '../domain/vehicle';
import type { Listing } from '../local/listings';

export type SectionKey = 'basics' | 'technical' | 'history' | 'colors' | 'equipment' | 'price' | 'vinNotes';

// Field names are Vehicle columns, Vehicle.data keys, details keys or Listing keys. A section counts as filled
// once any of its fields is set (make, model and body type are always set, so "basics" always counts).
export const SECTIONS: { key: SectionKey; fields: string[] }[] = [
  { key: 'basics', fields: ['make', 'model', 'bodyType', 'variant', 'firstRegistration'] },
  { key: 'technical', fields: ['fuel', 'transmission', 'powerKw', 'displacementCcm', 'drive'] },
  { key: 'history', fields: ['mileageKm', 'previousOwners', 'huUntil', 'accidentFree', 'serviceBook', 'nonSmoker'] },
  { key: 'colors', fields: ['colorExterior', 'colorInterior', 'upholstery'] },
  { key: 'equipment', fields: ['equipment'] },
  { key: 'price', fields: ['priceEur', 'vatDeductible', 'warrantyMonths', 'location'] },
  { key: 'vinNotes', fields: ['vin', 'notes'] },
];

const filled = (v: unknown) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

export function sectionDone(section: { fields: string[] }, v: Vehicle, l: Listing | null): boolean {
  const sources: Record<string, unknown>[] = [v, v.data, v.details, l ?? {}];
  return section.fields.some((f) => sources.some((s) => filled(s[f])));
}

export function sectionProgress(v: Vehicle, l: Listing | null): { done: number; total: number } {
  return { done: SECTIONS.filter((s) => sectionDone(s, v, l)).length, total: SECTIONS.length };
}
