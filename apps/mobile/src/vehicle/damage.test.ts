import { DAMAGE_PARTS } from '../domain/vehicleData';
import { damageSummary, setPartState } from './damage';
import { PART_PATHS } from './damageParts';

test('setPartState stores only parts that are not original', () => {
  const m = setPartState(setPartState({}, 'hood', 'painted'), 'roof', 'damaged');
  expect(setPartState(m, 'hood', 'original')).toEqual({ roof: 'damaged' });
});

test('damageSummary groups parts by state', () => {
  expect(damageSummary({ hood: 'painted', door_front_left: 'painted', roof: 'replaced' })).toEqual({
    painted: ['hood', 'door_front_left'], partly_painted: [], replaced: ['roof'], damaged: [],
  });
});

test('every damage part has a drawing', () => {
  expect(Object.keys(PART_PATHS).sort()).toEqual([...DAMAGE_PARTS].sort());
});
