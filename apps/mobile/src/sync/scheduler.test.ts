import { createSyncScheduler } from './scheduler';

// A run that finishes only when the test says so.
function controlledRun() {
  const finishers: (() => void)[] = [];
  const run = jest.fn(() => new Promise<void>((resolve) => finishers.push(resolve)));
  const finishNext = async () => {
    finishers.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { run, finishNext };
}

test('a request while idle runs immediately', async () => {
  const { run, finishNext } = controlledRun();
  const scheduler = createSyncScheduler(run);

  scheduler.request();
  expect(run).toHaveBeenCalledTimes(1);

  await finishNext();
  await scheduler.idle();
  expect(run).toHaveBeenCalledTimes(1);
});

test('requests during a run coalesce into one extra run', async () => {
  const { run, finishNext } = controlledRun();
  const scheduler = createSyncScheduler(run);

  scheduler.request();
  scheduler.request();
  scheduler.request();
  scheduler.request();
  expect(run).toHaveBeenCalledTimes(1);

  await finishNext();
  expect(run).toHaveBeenCalledTimes(2);

  await finishNext();
  await scheduler.idle();
  expect(run).toHaveBeenCalledTimes(2);
});

test('subscribers hear about every finished run, failed ones too', async () => {
  const run = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const scheduler = createSyncScheduler(run);
  const listener = jest.fn();
  scheduler.subscribe(listener);

  scheduler.request();
  await scheduler.idle();
  expect(listener).toHaveBeenCalledTimes(1);

  scheduler.request();
  await scheduler.idle();
  expect(listener).toHaveBeenCalledTimes(2);
});

test('an unsubscribed listener is not called', async () => {
  const scheduler = createSyncScheduler(jest.fn().mockResolvedValue(undefined));
  const listener = jest.fn();
  const unsubscribe = scheduler.subscribe(listener);
  unsubscribe();

  scheduler.request();
  await scheduler.idle();
  expect(listener).not.toHaveBeenCalled();
});

test('a throwing subscriber does not stop later runs', async () => {
  const run = jest.fn().mockResolvedValue(undefined);
  const scheduler = createSyncScheduler(run);
  scheduler.subscribe(() => {
    throw new Error('screen gone');
  });

  scheduler.request();
  await scheduler.idle();
  scheduler.request();
  await scheduler.idle();
  expect(run).toHaveBeenCalledTimes(2);
});

test('a failing run does not stop later requests', async () => {
  const run = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const scheduler = createSyncScheduler(run);

  scheduler.request();
  await scheduler.idle();
  scheduler.request();
  await scheduler.idle();

  expect(run).toHaveBeenCalledTimes(2);
});
