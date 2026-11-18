import type { Vehicle } from '../domain/vehicle';
import { emptyVehicleData, type VehicleDetails } from '../domain/vehicleData';
import { applySuggestions } from './apply';

const vehicle = (over: { details?: VehicleDetails; damage?: Vehicle['damage'] }): Vehicle => ({
  id: 'v1', galleryId: 'g1', make: 'VW', model: 'Golf', bodyType: 'hatchback', status: 'draft',
  data: emptyVehicleData(), damage: over.damage ?? {}, damageCheckedAt: '2026-11-01T00:00:00Z', details: over.details ?? {},
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', factsUpdatedAt: '2026-11-01T00:00:00Z',
});

test('applySuggestions writes accepted values and merges damage and equipment', () => {
  const patch = applySuggestions(vehicle({ details: { equipment: ['abs'] } }), [
    { kind: 'field', field: 'mileageKm', value: 87000, quote: 'km 87.000' },
    { kind: 'damage', part: 'hood', state: 'painted', quote: 'Motorhaube lackiert' },
    { kind: 'equipment', code: 'navigation', quote: 'Navi' },
  ]);
  expect(patch.data).toEqual(expect.objectContaining({ mileageKm: 87000 }));
  expect(patch.damage).toEqual({ hood: 'painted' });
  expect(patch.details!.equipment).toEqual(['abs', 'navigation']);
  expect(patch).not.toHaveProperty('damageCheckedAt');
});

test('applySuggestions ignores values the lists do not allow', () => {
  const patch = applySuggestions(vehicle({}), [{ kind: 'field', field: 'fuel', value: 'kerosene', quote: '' }]);
  expect(patch.data?.fuel).toBeUndefined();
});

test('make and model go to the top level; empty ones are skipped', () => {
  const patch = applySuggestions(vehicle({}), [
    { kind: 'field', field: 'make', value: 'Audi', quote: 'Audi' },
    { kind: 'field', field: 'model', value: '  ', quote: 'x' },
  ]);
  expect(patch.make).toBe('Audi');
  expect(patch).not.toHaveProperty('model');
  expect(patch.data).toEqual({});
});

test('damage keeps other parts and equipment is not duplicated', () => {
  const patch = applySuggestions(vehicle({ damage: { roof: 'damaged' }, details: { equipment: ['abs'] } }), [
    { kind: 'damage', part: 'hood', state: 'replaced', quote: 'a' },
    { kind: 'equipment', code: 'abs', quote: 'b' },
    { kind: 'equipment', code: 'radio', quote: 'c' },
    { kind: 'equipment', code: 'radio', quote: 'c' },
  ]);
  expect(patch.damage).toEqual({ roof: 'damaged', hood: 'replaced' });
  expect(patch.details!.equipment).toEqual(['abs', 'radio']);
});

test('nothing accepted changes nothing', () => {
  expect(applySuggestions(vehicle({}), [])).toEqual({ data: {} });
});
