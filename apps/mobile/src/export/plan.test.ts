import type { StudioPhoto } from '../studio/status';
import { exportItems, exportName } from './plan';

const photo = (id: string, slot: StudioPhoto['slot'], status: StudioPhoto['process_status'] = 'done'): StudioPhoto => ({
  id, slot, process_status: status, process_error: null,
  output_path: status === 'done' ? `g/v/${id}/out.jpg` : null,
  output_wm_path: status === 'done' ? `g/v/${id}/outwm.jpg` : null,
  mask_path: null, original_path: `g/v/${slot}.jpg`, captured_at: '2026-11-16T10:00:00Z',
  placement: null, plate_corners: null, plate_status: null, mask_edits: [], updated_at: '2026-11-16T10:00:00Z',
});

// Listing order: front_left_45, front, …, rear …; detail after exterior.
const photos = [photo('r', 'rear'), photo('f', 'front'), photo('x', 'front_left_45', 'failed'), photo('u', 'detail_wheel', 'unprocessed'), photo('l', 'left')];

test('exportName numbers from 01', () => {
  expect(exportName(0, 'front_left_45')).toBe('01_front_left_45.jpg');
  expect(exportName(9, 'rear')).toBe('10_rear.jpg');
});

test('exportItems keeps listing order and skips photos without the chosen version', () => {
  expect(exportItems(photos, 'watermarked')).toEqual([
    { photoId: 'f', bucket: 'processed', path: 'g/v/f/outwm.jpg', name: '01_front.jpg' },
    { photoId: 'r', bucket: 'processed', path: 'g/v/r/outwm.jpg', name: '02_rear.jpg' },
    { photoId: 'l', bucket: 'processed', path: 'g/v/l/outwm.jpg', name: '03_left.jpg' },
  ]);
  expect(exportItems(photos, 'plain').map((i) => i.path)).toEqual(['g/v/f/out.jpg', 'g/v/r/out.jpg', 'g/v/l/out.jpg']);
  expect(exportItems(photos, 'originals').map((i) => [i.bucket, i.name])).toEqual([
    ['originals', '01_front_left_45.jpg'], ['originals', '02_front.jpg'], ['originals', '03_rear.jpg'],
    ['originals', '04_left.jpg'], ['originals', '05_detail_wheel.jpg'],
  ]);
});

test('exportItems honours the selection but keeps listing numbers dense', () => {
  const items = exportItems(photos, 'originals', new Set(['u', 'r', 'x']));
  expect(items.map((i) => i.name)).toEqual(['01_front_left_45.jpg', '02_rear.jpg', '03_detail_wheel.jpg']);
});
