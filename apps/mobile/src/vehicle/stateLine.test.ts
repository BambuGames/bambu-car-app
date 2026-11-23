import { stateLine } from './stateLine';

test('a ready vehicle reads Fertig', () => {
  expect(stateLine({ status: 'ready', exteriorDone: 8, pendingUploads: 0 })).toEqual({ tone: 'ok', key: 'vehicles.status.ready' });
});

test('processing reads In Bearbeitung', () => {
  expect(stateLine({ status: 'processing', exteriorDone: 8, pendingUploads: 0 })).toEqual({
    tone: 'wait',
    key: 'vehicles.status.processing',
  });
});

test('uploads still pending win over shooting', () => {
  expect(stateLine({ status: 'shooting', exteriorDone: 3, pendingUploads: 2 })).toEqual({
    tone: 'wait',
    key: 'vehicles.pendingUploads',
    params: { count: 2 },
  });
});

test('missing exterior angles are the next step', () => {
  expect(stateLine({ status: 'shooting', exteriorDone: 5, pendingUploads: 0 })).toEqual({
    tone: 'mark',
    key: 'vehicles.exteriorMissing',
    params: { done: 5, total: 8, missing: 3 },
    meter: { done: 5, total: 8 },
  });
});

test('a fully shot vehicle waits for processing', () => {
  expect(stateLine({ status: 'shooting', exteriorDone: 8, pendingUploads: 0 })).toEqual({
    tone: 'wait',
    key: 'vehicles.waitingForProcessing',
  });
});

test('a draft with no shots reads Noch keine Fotos', () => {
  expect(stateLine({ status: 'draft', exteriorDone: 0, pendingUploads: 0 })).toEqual({ tone: 'neutral', key: 'vehicles.noPhotos' });
});
