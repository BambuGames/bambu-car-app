import { missingExterior, uploadSummary } from './progress';

test('missingExterior lists missing slots in walking order', () => {
  expect(missingExterior([{ slot: 'front_left_45' }, { slot: 'front' }, { slot: 'detail_wheel' }])).toEqual([
    'front_right_45',
    'right',
    'rear_right_45',
    'rear',
    'rear_left_45',
    'left',
  ]);
});

test('missingExterior is empty once all eight exterior slots are taken', () => {
  const all = ['front_left_45', 'front', 'front_right_45', 'right', 'rear_right_45', 'rear', 'rear_left_45', 'left'] as const;
  expect(missingExterior(all.map((slot) => ({ slot })))).toEqual([]);
});

test('uploadSummary reports offline, retrying and uploading states', () => {
  expect(uploadSummary({ pending: 0, failed: 0, online: true })).toBeNull();
  expect(uploadSummary({ pending: 2, failed: 1, online: false })).toEqual({ key: 'sync.offlinePending', count: 3 });
  expect(uploadSummary({ pending: 2, failed: 1, online: true })).toEqual({ key: 'sync.retrying', count: 1 });
  expect(uploadSummary({ pending: 2, failed: 0, online: true })).toEqual({ key: 'sync.uploading', count: 2 });
});
