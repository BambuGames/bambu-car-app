import { othersEditing } from './presence';

test('othersEditing ignores this device and repeats', () => {
  expect(
    othersEditing(
      { a: [{ device: 'me', name: 'staff' }], b: [{ device: 'x', name: 'owner' }, { device: 'x', name: 'owner' }] },
      'me',
    ),
  ).toEqual(['owner']);
});
