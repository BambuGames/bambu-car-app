import { emptyVehicleData } from '../domain/vehicleData';
import { listFacts, pageFacts } from './facts';

const data = { ...emptyVehicleData(), firstRegistration: '2024-07-01', powerKw: 96, mileageKm: 45004, fuel: 'petrol' as const };

test('list facts read B, P.2 and km in German formats', () => {
  expect(listFacts(data, 'de-DE')).toEqual([
    { code: 'B', value: '07/2024' },
    { code: 'P.2', value: '96 kW' },
    { code: 'km', value: '45.004' },
  ]);
});

test('list facts keep B, P.2 and km in place, unknown ones as null', () => {
  expect(listFacts({ ...data, powerKw: null, mileageKm: null }, 'de-DE')).toEqual([
    { code: 'B', value: '07/2024' },
    { code: 'P.2', value: null },
    { code: 'km', value: null },
  ]);
  expect(listFacts(emptyVehicleData(), 'de-DE').map((f) => f.value)).toEqual([null, null, null]);
});

test('page facts always show B, P.2, P.3 and km, empty ones as null', () => {
  expect(pageFacts(emptyVehicleData(), 'de-DE', (f) => f)).toEqual([
    { code: 'B', value: null },
    { code: 'P.2', value: null },
    { code: 'P.3', value: null },
    { code: 'km', value: null },
  ]);
  expect(pageFacts(data, 'en-GB', (f) => `fuel:${f}`)[2]).toEqual({ code: 'P.3', value: 'fuel:petrol' });
});
