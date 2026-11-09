// The expo-sqlite adapter keeps one connection per user: a second connection to the same file
// would stay open after sign-out and make deleting the file fail.
import * as SQLite from 'expo-sqlite';

import { deleteUserDb, openUserDb } from './sqlite';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(async () => {}),
}));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;
const deleteDatabaseAsync = SQLite.deleteDatabaseAsync as jest.Mock;

function fakeConnection() {
  return {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async () => {}),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => ({ user_version: 1000 })), // already migrated
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    closeAsync: jest.fn(async () => {}),
  };
}

beforeEach(() => {
  openDatabaseAsync.mockReset().mockImplementation(async () => fakeConnection());
  deleteDatabaseAsync.mockClear();
});

test('signing the same user in again reuses the open connection', async () => {
  const [first, second] = await Promise.all([openUserDb('u1'), openUserDb('u1')]);
  const third = await openUserDb('u1');

  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
  expect(third).toBe(first);
  await deleteUserDb('u1');
});

test('deleting closes the only connection before removing the file', async () => {
  await openUserDb('u2');
  await openUserDb('u2');
  const connection = await openDatabaseAsync.mock.results[0].value;

  await deleteUserDb('u2');

  expect(connection.closeAsync).toHaveBeenCalledTimes(1);
  expect(deleteDatabaseAsync).toHaveBeenCalledWith('user-u2.db');
  expect(connection.closeAsync.mock.invocationCallOrder[0]).toBeLessThan(deleteDatabaseAsync.mock.invocationCallOrder[0]);

  await openUserDb('u2');
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  await deleteUserDb('u2');
});
