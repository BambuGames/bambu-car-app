import { readAll } from './remote';

// A server that answers at most `cap` rows per request, like PostgREST's max_rows.
function pagedServer(rows: number[], cap: number) {
  const asked: [number, number][] = [];
  const page = async (from: number, to: number) => {
    asked.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { page, asked };
}

test('readAll reads every row even when the server answers fewer rows than asked for', async () => {
  const server = pagedServer([1, 2, 3, 4, 5, 6, 7], 3);
  expect(await readAll(server.page, 5)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(server.asked.map(([from]) => from)).toEqual([0, 3, 6, 7]);
});

test('readAll fails when a page fails', async () => {
  const page = async () => ({ data: null, error: { message: 'boom' } });
  await expect(readAll(page)).rejects.toThrow('boom');
});
