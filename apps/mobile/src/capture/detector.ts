// On-device vehicle detector chosen in M0: EfficientDet-Lite2 on the iOS CPU, Lite0 with the Android GPU
// delegate. The TFLite detection post-process op is in the model, so outputs are boxes, classes, scores, count.
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { loadTensorflowModel, type TensorflowModel, type TensorflowModelDelegate } from 'react-native-fast-tflite';

export const MODEL: { asset: number; size: number; delegates: TensorflowModelDelegate[] } =
  Platform.OS === 'ios'
    ? { asset: require('../../assets/models/efficientdet_lite2_det.tflite'), size: 448, delegates: [] }
    : { asset: require('../../assets/models/efficientdet_lite0_det.tflite'), size: 320, delegates: ['android-gpu'] };

// A GPU delegate that cannot start fails the whole interpreter; without this the phone would silently lose
// detection and drop to simple mode. The CPU is slower but still guides.
export async function withCpuFallback<T, D>(load: (delegates: D[]) => Promise<T>, delegates: D[]): Promise<T> {
  try {
    return await load(delegates);
  } catch (error) {
    if (delegates.length === 0) throw error;
    return load([]);
  }
}

// Android release builds hand fast-tflite a bundled asset as a bare resource name it cannot open (M0), so the
// model is copied to a file first and loaded by URL.
export function useDetectorModel(): { model: TensorflowModel | null; error: string | null } {
  const [model, setModel] = useState<TensorflowModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Asset.fromModule(MODEL.asset)
      .downloadAsync()
      .then((asset) => withCpuFallback((d) => loadTensorflowModel({ url: asset.localUri! }, d), MODEL.delegates))
      .then((m) => {
        if (!active) return;
        if (__DEV__) console.log('[detector] outputs', JSON.stringify(m.outputs));
        setModel(m);
      })
      .catch((e: unknown) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, []);
  return { model, error };
}
