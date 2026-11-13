import { DETAIL_SLOTS, EXTERIOR_SLOTS, INTERIOR_SLOTS, type Slot } from '../domain/slots';
import { coverPhoto, coversByVehicle, LISTING_ORDER, orderPhotos, plateQueue } from './order';
import type { StudioPhoto } from './status';

test('orderPhotos puts the walk order first, then details, then interior', () => {
  expect(LISTING_ORDER).toEqual([...EXTERIOR_SLOTS, ...DETAIL_SLOTS, ...INTERIOR_SLOTS]);
  const shuffled: { slot: Slot }[] = [{ slot: 'interior_cockpit' }, { slot: 'detail_wheel' }, { slot: 'left' }, { slot: 'front_left_45' }];
  expect(orderPhotos(shuffled).map((p) => p.slot)).toEqual(['front_left_45', 'left', 'detail_wheel', 'interior_cockpit']);
});

test('coverPhoto is the first processed photo in listing order', () => {
  const photos = [
    { slot: 'front' as Slot, process_status: 'done' },
    { slot: 'front_left_45' as Slot, process_status: 'failed' },
    { slot: 'detail_wheel' as Slot, process_status: 'done' },
  ];
  expect(coverPhoto(photos)?.slot).toBe('front');
  expect(coverPhoto([{ slot: 'front' as Slot, process_status: 'queued' }])).toBeNull();
});

test("covers pick each vehicle's first processed photo in listing order", () => {
  const rows = [
    { vehicle_id: 'v1', slot: 'front' as Slot, process_status: 'done', output_path: 'v1/front.jpg' },
    { vehicle_id: 'v1', slot: 'front_left_45' as Slot, process_status: 'done', output_path: 'v1/fl.jpg' },
    { vehicle_id: 'v2', slot: 'front' as Slot, process_status: 'failed', output_path: null },
  ];
  expect(coversByVehicle(rows)).toEqual({ v1: 'v1/fl.jpg', v2: null });
});

describe('plateQueue', () => {
  const p = (id: string, slot: StudioPhoto['slot'], plate_status: StudioPhoto['plate_status']) =>
    ({ id, slot, process_status: 'done', plate_status }) as StudioPhoto;
  const photos = [p('a', 'front', 'confirmed'), p('b', 'rear', 'auto'), p('c', 'front_left_45', 'needs_check')];

  test('lists photos waiting for a plate check in listing order, minus those handled here', () => {
    expect(plateQueue(photos, { done: [], retry: null }).map((x) => x.id)).toEqual(['c', 'b']);
    expect(plateQueue(photos, { done: ['c'], retry: null }).map((x) => x.id)).toEqual(['b']);
  });

  test('a photo whose fix was saved but could not be re-rendered stays in the list', () => {
    expect(plateQueue(photos, { done: [], retry: 'a' }).map((x) => x.id)).toContain('a');
  });

  test('opened for one photo, the queue is that photo until it is handled', () => {
    expect(plateQueue(photos, { photoId: 'a', done: [], retry: null }).map((x) => x.id)).toEqual(['a']);
    expect(plateQueue(photos, { photoId: 'a', done: ['a'], retry: null })).toEqual([]);
  });
});
