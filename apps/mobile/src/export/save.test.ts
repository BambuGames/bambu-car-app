import type { ExportItem } from './plan';
import { saveToPhotos, type SaveDeps } from './save';

const items: ExportItem[] = ['01_front.jpg', '02_rear.jpg', '03_left.jpg'].map((name, i) => ({
  photoId: `p${i}`, bucket: 'processed', path: `g/v/p${i}/outwm.jpg`, name,
}));

function fakeDeps(over: Partial<SaveDeps> = {}) {
  const log = { downloaded: [] as string[], saved: [] as string[], removed: [] as string[] };
  const deps: SaveDeps = {
    requestPermission: async () => true,
    signedUrl: async (item) => `https://storage.test/${item.path}?token=t`,
    download: async (_url, name) => {
      log.downloaded.push(name);
      return `file:///cache/${name}`;
    },
    saveToLibrary: async (uri) => void log.saved.push(uri),
    remove: (uri) => void log.removed.push(uri),
    ...over,
  };
  return { deps, log };
}

test('saveToPhotos reports denied without downloading anything', async () => {
  const { deps, log } = fakeDeps({ requestPermission: async () => false });
  expect(await saveToPhotos(items, deps)).toEqual({ status: 'denied' });
  expect(log.downloaded).toEqual([]);
});

test('saveToPhotos counts a photo that could not be saved and carries on', async () => {
  const { deps, log } = fakeDeps();
  const failing: SaveDeps = {
    ...deps,
    download: async (url, name) => {
      if (name === '02_rear.jpg') throw new Error('network');
      return deps.download(url, name);
    },
  };
  const progress: number[] = [];
  expect(await saveToPhotos(items, failing, (done) => progress.push(done))).toEqual({ status: 'done', saved: 2, failed: 1 });
  expect(log.saved).toEqual(['file:///cache/01_front.jpg', 'file:///cache/03_left.jpg']);
  expect(log.removed).toEqual(['file:///cache/01_front.jpg', 'file:///cache/03_left.jpg']); // temp files go
  expect(progress).toEqual([1, 2, 3]);
});
