import { EXTERIOR_SLOTS } from '../domain/slots';
import { listStatusKey } from './listStatus';

// M5: a vehicle whose exterior is shot and uploaded waits for the owner to process it.
const all = EXTERIOR_SLOTS.length;

test('a fully shot, uploaded vehicle waits for processing', () => {
  expect(listStatusKey({ status: 'shooting', exteriorDone: all, pendingUploads: 0 })).toBe('vehicles.waitingForProcessing');
});

test('still uploading stays shooting', () => {
  expect(listStatusKey({ status: 'shooting', exteriorDone: all, pendingUploads: 1 })).toBe('vehicles.status.shooting');
});

test('missing an exterior angle stays shooting', () => {
  expect(listStatusKey({ status: 'shooting', exteriorDone: all - 1, pendingUploads: 0 })).toBe('vehicles.status.shooting');
});

test('other statuses keep their own label', () => {
  expect(listStatusKey({ status: 'ready', exteriorDone: all, pendingUploads: 0 })).toBe('vehicles.status.ready');
  expect(listStatusKey({ status: 'draft', exteriorDone: 0, pendingUploads: 0 })).toBe('vehicles.status.draft');
});
