jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: jest.fn() }));
jest.mock('expo-asset', () => ({ Asset: {} }));
jest.mock('../../assets/models/efficientdet_lite2_det.tflite', () => 1);
jest.mock('../../assets/models/efficientdet_lite0_det.tflite', () => 2);

import { withCpuFallback } from './detector';

test('falls back to the CPU when the GPU delegate cannot start', async () => {
  const tried: string[][] = [];
  const load = async (delegates: string[]) => {
    tried.push(delegates);
    if (delegates.length > 0) throw new Error('Failed to create TFLite interpreter!');
    return 'cpu model';
  };
  await expect(withCpuFallback(load, ['android-gpu'])).resolves.toBe('cpu model');
  expect(tried).toEqual([['android-gpu'], []]);
});

test('passes a CPU load error through', async () => {
  const load = async () => {
    throw new Error('bad model');
  };
  await expect(withCpuFallback(load, [])).rejects.toThrow('bad model');
});
