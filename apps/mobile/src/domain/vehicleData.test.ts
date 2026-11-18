import i18n from '../lib/i18n';
import * as shared from '../../../../supabase/functions/_shared/vehicleData';
import * as app from './vehicleData';
import { kwToPs, monthOf, validateVehicleData } from './vehicleData';

const LISTS = [
  'FUELS', 'TRANSMISSIONS', 'DRIVES', 'EXTERIOR_COLORS', 'INTERIOR_COLORS', 'UPHOLSTERIES',
  'EQUIPMENT', 'DAMAGE_PARTS', 'DAMAGE_STATES', 'LANGUAGES',
] as const;

test('validateVehicleData flags values outside the lists and impossible numbers', () => {
  expect(validateVehicleData({ fuel: 'kerosene' as never, mileageKm: -5, vin: 'ABC' })).toEqual({ fuel: 'invalid', mileageKm: 'invalid', vin: 'invalid' });
  expect(validateVehicleData({ fuel: 'diesel', mileageKm: 120000, vin: 'WVWZZZ1KZAW000001' })).toEqual({});
  expect(validateVehicleData({ vin: 'wvwzzz1kzaw000001' })).toEqual({});
  expect(validateVehicleData({ vin: 'WVWZZZ1KZAW00000I' })).toEqual({ vin: 'invalid' });
  expect(validateVehicleData({ firstRegistration: '2019-03-17' })).toEqual({ firstRegistration: 'invalid' });
  expect(validateVehicleData({ firstRegistration: '2019-03-01', fuel: null, vin: null })).toEqual({});
});

test('kwToPs and monthOf', () => {
  expect(kwToPs(110)).toBe(150);
  expect(monthOf('2019-03-17')).toBe('2019-03-01');
  expect(monthOf(null)).toBeNull();
});

test('the lists have the expected sizes', () => {
  expect(app.EQUIPMENT).toHaveLength(44);
  expect(app.DAMAGE_PARTS).toHaveLength(15);
});

test('the edge functions use the same value lists as the app', () => {
  for (const name of LISTS) expect(shared[name]).toEqual(app[name]);
});

test('every value has a label in every language', () => {
  for (const lng of app.LANGUAGES) {
    for (const name of LISTS.filter((n) => n !== 'LANGUAGES')) {
      for (const value of app[name]) {
        expect(i18n.exists(`vehicleData.values.${name}.${value}`, { lng })).toBe(true);
      }
    }
  }
});
