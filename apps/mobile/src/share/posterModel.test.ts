import { emptyVehicleData } from '../domain/vehicleData';
import type { Vehicle } from '../domain/vehicle';
import type { Listing } from '../local/listings';
import i18n from '../lib/i18n';
import { fitFacts, fitTitle, posterModel } from './posterModel';

const t = i18n.getFixedT('de');
// Node's ICU puts a (narrow) no-break space before the euro sign and before "km"; compare what a person sees.
const seen = (s: string) => s.replace(/[  ]/g, ' ');

const vehicle = (o: { data?: Partial<Vehicle['data']> } = {}): Vehicle => ({
  id: 'v1', galleryId: 'g1', make: 'Opel', model: 'Crossland', bodyType: 'suv', status: 'ready',
  data: { ...emptyVehicleData(), ...o.data }, damage: {}, damageCheckedAt: null, details: {},
  createdAt: '', updatedAt: '', factsUpdatedAt: '',
});
const crossland = vehicle({
  data: {
    variant: '1.2 130 AT6 ESSENTIAL', firstRegistration: '2024-07-01', mileageKm: 45004,
    fuel: 'petrol', transmission: 'automatic', vin: 'W0V7D9EA1R1234567',
  },
});
const listing = (o: Partial<Listing>): Listing => ({
  id: 'v1', galleryId: 'g1', status: 'draft', priceEur: null, vatDeductible: null, warrantyMonths: null,
  location: null, createdAt: '', updatedAt: '', factsUpdatedAt: '', ...o,
});

test('posterModel builds the band from vehicle, listing and gallery', () => {
  const m = posterModel(crossland, listing({ priceEur: 17990, vatDeductible: true, warrantyMonths: 12, location: 'Berlin' }),
    { phone: '+49 30 1234567', whatsapp: '+49 170 1234567' }, 'de', t);
  expect(m.title).toBe('Opel Crossland 1.2 130 AT6 ESSENTIAL');
  expect(m.facts.map(seen)).toEqual(['07/2024', '45.004 km', 'Benzin', 'Automatik']);
  expect(seen(m.price)).toBe('17.990 €');
  expect(m.priceNote).toBe('MwSt. ausweisbar · 12 Monate Garantie');
  expect(m.location).toBe('Berlin');
  expect(m.contact).toEqual({ phone: '+49 30 1234567', whatsapp: '+49 170 1234567' });
  expect(JSON.stringify(m)).not.toContain(crossland.data.vin!);
});

test('posterModel skips missing facts and falls back to Preis auf Anfrage', () => {
  const m = posterModel(vehicle({ data: { fuel: 'diesel' } }), null, { phone: null, whatsapp: null }, 'de', t);
  expect(m.facts).toEqual(['Diesel']);
  expect(m.price).toBe('Preis auf Anfrage');
  expect(m.priceNote).toBeNull();
  expect(m.location).toBeNull();
});

test('posterModel has no contact line when the gallery has no numbers', () => {
  expect(posterModel(crossland, null, { phone: null, whatsapp: null }, 'de', t).contact).toBeNull();
});

test('fitTitle wraps to two lines and ends with an ellipsis', () => {
  const measure = (s: string) => s.length * 10;
  expect(fitTitle('Mercedes-Benz GLC 300 e 4MATIC Coupé AMG Line Plug-in', 200, 2, measure))
    .toEqual(['Mercedes-Benz GLC', expect.stringMatching(/…$/)]);
});

test('fitTitle cuts an over-wide word on a non-last line', () => {
  const measure = (s: string) => s.length * 10;
  const lines = fitTitle('Supercalifragilisticexpialidocious GT', 200, 2, measure);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toMatch(/…$/);
  expect(measure(lines[0])).toBeLessThanOrEqual(200);
});

test('fitFacts drops items from the end until the line fits', () => {
  const measure = (s: string) => s.length * 10;
  expect(fitFacts(['07/2024', '45.004 km', 'Benzin', 'Automatik'], 240, ' · ', measure)).toEqual(['07/2024', '45.004 km']);
});
