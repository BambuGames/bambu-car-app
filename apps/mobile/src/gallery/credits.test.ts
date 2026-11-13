import { entryLabel, type CreditEntry } from './credits';

const t = (key: string, options: { vehicle: string }) => (options.vehicle ? `${key}|${options.vehicle}` : key);
const entry = (over: Partial<CreditEntry>): CreditEntry => ({ amount: 1, reason: 'grant', vehicle: null, note: null, created_at: '2026-11-12T10:00:00Z', ...over });

test('entry labels follow the reason and name the vehicle', () => {
  expect(entryLabel(entry({ amount: 50, reason: 'grant', note: 'Pilotpaket' }), t)).toBe('credits.grant');
  expect(entryLabel(entry({ amount: -1, reason: 'vehicle', vehicle: 'VW Golf' }), t)).toBe('credits.vehicle|VW Golf');
  expect(entryLabel(entry({ amount: 1, reason: 'refund', vehicle: 'VW Golf' }), t)).toBe('credits.refund|VW Golf');
});
