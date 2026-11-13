import { isStuck, msUntilStuck, originalKey, processBlocker, summarize, type StudioPhoto } from './status';

const NOW = Date.parse('2026-11-12T12:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const photo = (over: Partial<StudioPhoto>): StudioPhoto => ({
  id: 'p', slot: 'front', process_status: 'done', process_error: null, output_path: 'o.jpg', output_wm_path: 'w.jpg', mask_path: null,
  original_path: 'g/v/front.jpg', captured_at: ago(60), placement: null, plate_corners: null, plate_status: 'confirmed', mask_edits: [],
  updated_at: ago(1), ...over,
});

test('a photo processing for over 10 minutes counts as stuck', () => {
  expect(isStuck(photo({ process_status: 'processing', updated_at: ago(11) }), NOW)).toBe(true);
  expect(isStuck(photo({ process_status: 'queued', updated_at: ago(11) }), NOW)).toBe(true);
  expect(isStuck(photo({ process_status: 'processing', updated_at: ago(5) }), NOW)).toBe(false);
  expect(isStuck(photo({ process_status: 'done', updated_at: ago(30) }), NOW)).toBe(false);
});

test('processBlocker says offline before anything else', () => {
  expect(processBlocker({ online: false, pendingUploads: 3, photos: [photo({ process_status: 'unprocessed' })], now: NOW })).toBe('offline');
});

test('processBlocker says uploading while photos wait', () => {
  expect(processBlocker({ online: true, pendingUploads: 2, photos: [photo({ process_status: 'unprocessed' })], now: NOW })).toBe('uploading');
});

test('processBlocker allows a retry of failed or stuck photos', () => {
  const done = photo({});
  expect(processBlocker({ online: true, pendingUploads: 0, photos: [done, photo({ process_status: 'failed' })], now: NOW })).toBeNull();
  expect(processBlocker({ online: true, pendingUploads: 0, photos: [done, photo({ process_status: 'processing', updated_at: ago(12) })], now: NOW })).toBeNull();
  expect(processBlocker({ online: true, pendingUploads: 0, photos: [done, photo({ process_status: 'processing' })], now: NOW })).toBe('running');
  expect(processBlocker({ online: true, pendingUploads: 0, photos: [done], now: NOW })).toBe('nothing');
});

test('summarize counts plate checks only on processed photos', () => {
  const s = summarize([
    photo({ plate_status: 'auto' }),
    photo({ plate_status: 'needs_check' }),
    photo({ process_status: 'failed', plate_status: 'auto' }),
    photo({ process_status: 'processing', updated_at: ago(15) }),
    photo({ process_status: 'queued' }),
    photo({ process_status: 'unprocessed', plate_status: null }),
  ], NOW);
  expect(s).toEqual({ total: 6, done: 2, failed: 1, running: 2, stuck: 1, unprocessed: 1, plateChecks: 2 });
});

test('processBlocker says running, not "all processed", while photos are in the queue', () => {
  const photos = [photo({ process_status: 'queued' }), photo({ process_status: 'done' })];
  expect(processBlocker({ online: true, pendingUploads: 0, photos, now: NOW })).toBe('running');
});

test('the studio knows when the next running photo will count as stuck', () => {
  const photos = [
    photo({ process_status: 'processing', updated_at: ago(4) }),
    photo({ process_status: 'queued', updated_at: ago(7) }),
    photo({ process_status: 'done', updated_at: ago(30) }),
  ];
  expect(msUntilStuck(photos, NOW)).toBe(3 * 60_000);
  expect(msUntilStuck([photo({ process_status: 'processing', updated_at: ago(12) })], NOW)).toBeNull(); // already stuck
  expect(msUntilStuck([photo({ process_status: 'done' })], NOW)).toBeNull();
});

test('a retaken original gets a new cache key although its path stays', () => {
  const first = photo({ original_path: 'g/v/front.jpg', captured_at: '2026-11-12T10:00:00Z' });
  const retake = photo({ original_path: 'g/v/front.jpg', captured_at: '2026-11-12T11:00:00Z' });
  expect(originalKey(first)).not.toBe(originalKey(retake));
});
