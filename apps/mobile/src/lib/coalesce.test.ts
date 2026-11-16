import { coalesce } from './coalesce';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('coalesce turns a burst of calls into one', () => {
  const fn = jest.fn();
  const burst = coalesce(fn, 250);
  for (let i = 0; i < 5; i++) {
    burst.call();
    jest.advanceTimersByTime(20);
  }
  expect(fn).not.toHaveBeenCalled();
  jest.advanceTimersByTime(250);
  expect(fn).toHaveBeenCalledTimes(1);
  burst.call();
  jest.advanceTimersByTime(250);
  expect(fn).toHaveBeenCalledTimes(2);
});

test('cancel drops the pending call', () => {
  const fn = jest.fn();
  const burst = coalesce(fn, 250);
  burst.call();
  burst.cancel();
  jest.advanceTimersByTime(1000);
  expect(fn).not.toHaveBeenCalled();
});
