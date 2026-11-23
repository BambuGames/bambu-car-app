import { codeFor } from './fieldCodes';

test('document fields carry their registration codes', () => {
  expect(codeFor('firstRegistration')).toBe('B');
  expect(codeFor('make')).toBe('D.1');
  expect(codeFor('model')).toBe('D.3');
  expect(codeFor('vin')).toBe('E');
  expect(codeFor('displacementCcm')).toBe('P.1');
  expect(codeFor('powerKw')).toBe('P.2');
  expect(codeFor('fuel')).toBe('P.3');
  expect(codeFor('colorExterior')).toBe('R');
});

test('fields without a document code get none', () => {
  for (const field of ['variant', 'mileageKm', 'huUntil', 'priceEur']) expect(codeFor(field)).toBeNull();
});
