// Wires the camera, the on-device detector and the motion sensors to the guidance logic (design 6.3).
// Decisions live in guidance.ts / geometry.ts; this hook only feeds them and keeps the latest readings.
import * as Device from 'expo-device';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import {
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import { useResizer } from 'react-native-vision-camera-resizer';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import type { CaptureInfo } from '../domain/capture';
import { isExterior, type ExteriorSlot, type Slot } from '../domain/slots';
import { templateFor, wideAllowed, type Box, type CaptureMode, type Template } from '../domain/templates';
import type { BodyType } from '../domain/vehicle';
import { useSession } from '../lib/session';
import { getMeta, setMeta } from '../local/meta';
import { canUseWide, hfovAfterCrop, shouldDetect, zoomFor } from './camera';
import { parseDetections } from './detections';
import { MODEL, useDetectorModel } from './detector';
import { plausibleHfov } from './exif';
import { center, pickTarget, scaleBox, silhouetteScale, uprightToBuffer, width, type Detection } from './geometry';
import {
  createAutoCapture,
  createRateMonitor,
  createSpaceAdvisor,
  evaluateGuidance,
  horizonDeg,
  tiltFromGravity,
  type GuidanceMessage,
  type GuidanceWarning,
} from './guidance';
import { takePhoto, type TakenPhoto } from './takePhoto';

const DEFAULT_HFOV: Record<CaptureMode, number> = { normal: 69, wide: 106 };
const FOCUS_EVERY_MS = 3000;
const FOCUS_STILL_MS = 1000;

// A detection from the frame processor: corners as camera points, plus mean brightness inside the box.
type RawDetection = { cls: Detection['cls']; score: number; p0: { x: number; y: number }; p1: { x: number; y: number }; luma: number };
type LiveDetection = Detection & { luma: number };

export type Guidance = {
  ready: boolean;
  message: GuidanceMessage | null;
  warnings: GuidanceWarning[];
  blockAuto: boolean;
  rollDeg: number;
  pitchDeg: number;
};

// Gravity before the first sensor reading (a phone lying flat): no tilt is known yet, so none is judged.
const NO_READING = { x: 0, y: 0, z: -9.81 };

export function useGuidedCamera({
  vehicleId,
  slot,
  bodyType,
  active,
  busy,
  onAuto,
}: {
  vehicleId: string;
  slot: Slot;
  bodyType: BodyType;
  active: boolean; // camera running: false under the review sheet or when the screen is not shown
  busy: boolean; // a photo is being taken, saved or reviewed: detection rests, the camera keeps running
  onAuto: () => void;
}) {
  const { db } = useSession();
  const exterior = isExterior(slot);
  const camera = useRef<CameraRef>(null);
  const permission = useCameraPermission();
  const device = useCameraDevice('back', { physicalDevices: ['ultra-wide-angle', 'wide-angle'] });
  const wideAvailable = device != null && canUseWide(device);
  const wideHere = wideAvailable && exterior && wideAllowed(slot as ExteriorSlot);

  const [mode, setMode] = useState<CaptureMode>('normal');
  const effectiveMode: CaptureMode =
    mode === 'wide' && wideHere ? 'wide' : 'normal';
  const template: Template | null = exterior ? templateFor(bodyType, slot as ExteriorSlot, effectiveMode) : null;

  // The phone's own field of view per lens, read from its first photo's EXIF; the template's until then.
  const [hfov, setHfov] = useState<Partial<Record<CaptureMode, number>>>({});
  const [autoCapture, setAutoCaptureState] = useState(true);
  useEffect(() => {
    if (!db) return;
    Promise.all([getMeta(db, 'hfov.normal'), getMeta(db, 'hfov.wide'), getMeta(db, 'autoCapture')]).then(([n, w, a]) => {
      setHfov({ normal: n ? Number(n) : undefined, wide: w ? Number(w) : undefined });
      setAutoCaptureState(a !== 'off');
    });
  }, [db]);
  const deviceHfov = hfov[effectiveMode] ?? template?.hfovDeg ?? DEFAULT_HFOV[effectiveMode];
  const scale = template ? silhouetteScale(template.hfovDeg, deviceHfov) : 1;
  const expected: Box | null = template ? scaleBox(template.box, scale) : null;

  const setAutoCapture = (on: boolean) => {
    setAutoCaptureState(on);
    if (db) setMeta(db, 'autoCapture', on ? 'on' : 'off');
  };

  // Frame processor: detection at most 10 times a second, nothing while inactive (heat, M0).
  const { model, error: detectorError } = useDetectorModel();
  const { resizer } = useResizer({
    width: MODEL.size,
    height: MODEL.size,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'stretch',
    pixelLayout: 'interleaved',
  });
  const [gate] = useState(() => ({ active: createSynchronizable(false), last: createSynchronizable(0) }));
  const runDetection = active && !busy && exterior && template !== null;

  const latest = useRef<{ raw: RawDetection[]; at: number }>({ raw: [], at: 0 });
  const rate = useRef(createRateMonitor());
  const onDetections = (raw: RawDetection[], at: number) => {
    latest.current = { raw, at };
    rate.current.tick(at);
  };
  const onFailedRun = (at: number) => rate.current.attempt(at);

  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_4_3,
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet';
      const now = Date.now();
      try {
        if (model == null || resizer == null || !shouldDetect(now, gate.last.getDirty(), gate.active.getDirty())) return;
        gate.last.setBlocking(now);
        const resized = resizer.resize(frame);
        const pixels = new Uint8Array(resized.getPixelBuffer());
        const out = model.runSync([pixels.buffer]);
        const dets = parseDetections(
          new Float32Array(out[0]),
          new Float32Array(out[1]),
          new Float32Array(out[2]),
          new Float32Array(out[3])[0],
        );
        const size = MODEL.size;
        const raw: RawDetection[] = [];
        for (const d of dets) {
          // Mean brightness inside the box, every 4th pixel of the model input (RGB, size × size).
          let sum = 0;
          let n = 0;
          for (let y = Math.floor(d.box.y0 * size); y < d.box.y1 * size; y += 4)
            for (let x = Math.floor(d.box.x0 * size); x < d.box.x1 * size; x += 4) {
              const i = (y * size + x) * 3;
              sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
              n++;
            }
          // The model saw the frame upright; the conversion wants raw buffer points (180° off in one landscape grip).
          const a = uprightToBuffer(d.box.x0, d.box.y0, frame.orientation);
          const b = uprightToBuffer(d.box.x1, d.box.y1, frame.orientation);
          raw.push({
            cls: d.cls,
            score: d.score,
            p0: frame.convertFramePointToCameraPoint({ x: a.x * frame.width, y: a.y * frame.height }),
            p1: frame.convertFramePointToCameraPoint({ x: b.x * frame.width, y: b.y * frame.height }),
            luma: n > 0 ? sum / n : 0,
          });
        }
        resized.dispose();
        scheduleOnRN(onDetections, raw, now);
      } catch {
        // No GPU path for the resizer (the emulator's Vulkan, maybe some phones): no detections, and the rate
        // monitor moves to simple mode after 3 s instead of an error on every frame.
        scheduleOnRN(onFailedRun, now);
      } finally {
        frame.dispose();
      }
    },
  });
  // 'native' is HEIC on iPhones; uploads, EXIF reading and processing expect JPEG.
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_4_3,
    qualityPrioritization: 'balanced',
    containerFormat: 'jpeg',
  });

  // The preview sits in a 4:3 box the size of the photo frame, so view points / box size = photo coordinates.
  const preview = useRef({ width: 0, height: 0 });
  const onPreviewLayout = (e: LayoutChangeEvent) => {
    preview.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  };
  const toBox = (r: RawDetection): Box | null => {
    const { width: w, height: h } = preview.current;
    if (!camera.current || w === 0) return null;
    const a = camera.current.convertCameraPointToViewPoint(r.p0);
    const b = camera.current.convertCameraPointToViewPoint(r.p1);
    return { x0: Math.min(a.x, b.x) / w, y0: Math.min(a.y, b.y) / h, x1: Math.max(a.x, b.x) / w, y1: Math.max(a.y, b.y) / h };
  };

  // Motion sensors: gravity for the tilt, rotation rate for steadiness.
  const motion = useRef({ g: NO_READING, rate: 0 });
  useEffect(() => {
    if (!active) return;
    DeviceMotion.setUpdateInterval(100);
    const sub = DeviceMotion.addListener((m) => {
      if (m.accelerationIncludingGravity) motion.current.g = m.accelerationIncludingGravity;
      if (m.rotationRate) {
        const { alpha, beta, gamma } = m.rotationRate;
        motion.current.rate = Math.max(Math.abs(alpha), Math.abs(beta), Math.abs(gamma));
      }
    });
    return () => sub.remove();
  }, [active]);

  // Guidance loop, ten times a second while active.
  const [guidance, setGuidance] = useState<Guidance>({ ready: false, message: null, warnings: [], blockAuto: false, rollDeg: 0, pitchDeg: 0 });
  const [simple, setSimple] = useState(false);
  const [advice, setAdvice] = useState<'suggestWide' | 'needsSpace' | null>(null);
  const target = useRef<LiveDetection | null>(null);
  const auto = useRef(createAutoCapture());
  const space = useRef(createSpaceAdvisor(false));
  // Detection starts or stops (busy, detail slot, focus): each start is a fresh step.
  // Paused time is not slowness, old boxes and a fired auto shot do not carry over, and the advisor offers
  // the 0.5x lens only where this slot has it (the device itself loads after the first render).
  useEffect(() => {
    gate.active.setBlocking(runDetection);
    rate.current.pause();
    latest.current = { raw: [], at: 0 };
    auto.current.reset();
    space.current = createSpaceAdvisor(wideHere);
  }, [gate, runDetection, wideHere]);
  const focus = useRef({ at: 0, still: 0, last: null as { x: number; y: number } | null });
  // The loop below runs in an interval; it reads this render's values from here.
  const noDetector = detectorError !== null; // no model even on the CPU: simple mode at once
  const step = useRef({ expected, autoCapture, effectiveMode, onAuto, noDetector });
  useEffect(() => {
    step.current = { expected, autoCapture, effectiveMode, onAuto, noDetector };
  });

  useEffect(() => {
    if (!active) return;
    auto.current.reset();
    const timer = setInterval(() => {
      const now = Date.now();
      const { expected: exp, autoCapture: autoOn, effectiveMode: lens, onAuto: fire, noDetector: off } = step.current;
      const isSimple = off || rate.current.isSimple(now);
      const dets: LiveDetection[] = [];
      for (const r of latest.current.raw) {
        const box = toBox(r);
        if (box) dets.push({ cls: r.cls, score: r.score, box, luma: r.luma });
      }
      const picked = exp ? (pickTarget(dets, exp) as LiveDetection | null) : null;
      target.current = picked;
      const tilt = tiltFromGravity(motion.current.g);
      const g = evaluateGuidance({
        tilt,
        rotationRateDegPerSec: motion.current.rate,
        expected: exp,
        target: picked,
        others: dets.filter((d) => d !== picked),
        detectionAgeMs: now - latest.current.at,
        simple: isSimple,
        lumaOnTarget: picked?.luma ?? null,
      });
      const next: Guidance = { ...g, rollDeg: tilt.rollDeg, pitchDeg: tilt.pitchDeg };
      setGuidance((prev) =>
        prev.ready === next.ready && prev.message === next.message && prev.warnings.join() === next.warnings.join() &&
        Math.abs(prev.rollDeg - next.rollDeg) < 0.5 && Math.abs(prev.pitchDeg - next.pitchDeg) < 0.5
          ? prev
          : next,
      );
      setSimple(isSimple);
      setAdvice(space.current.update(picked && exp && !isSimple ? width(picked.box) / width(exp) : null, lens, now));

      // Meter exposure on the car once it has stayed put for a second (works only where the device allows it).
      const c = picked ? center(picked.box) : null;
      const f = focus.current;
      if (!c || !f.last || Math.hypot(c.x - f.last.x, c.y - f.last.y) > 0.03) f.still = now;
      f.last = c;
      if (c && now - f.still >= FOCUS_STILL_MS && now - f.at >= FOCUS_EVERY_MS && camera.current) {
        f.at = now;
        camera.current.focusTo({ x: c.x * preview.current.width, y: c.y * preview.current.height }).catch(() => {});
      }

      if (autoOn && !isSimple && exp && auto.current.update(next.ready, next.blockAuto, now)) fire();
    }, 100);
    return () => clearInterval(timer);
  }, [active]);

  const capture = async (
    autoTaken: boolean,
    capturedAt: string,
  ): Promise<{ taken: TakenPhoto; info: CaptureInfo }> => {
    gate.active.setBlocking(false); // at once; busy follows with the next render
    const box = target.current?.box ?? null;
    const g = motion.current.g;
    const taken = await takePhoto(photoOutput, { vehicleId, slot, capturedAt, target: box, exterior, tilt: g === NO_READING ? null : tiltFromGravity(g) });
    const exifHfov = plausibleHfov(taken.focal35, effectiveMode);
    // EXIF describes the whole delivered frame; a photo cut to 4:3 sees less of it.
    const measured = exifHfov !== null && taken.cropShare < 1 ? hfovAfterCrop(exifHfov, taken.cropShare) : exifHfov;
    if (measured !== null && db) {
      setHfov((h) => ({ ...h, [effectiveMode]: measured }));
      await setMeta(db, `hfov.${effectiveMode}`, String(measured));
    }
    const info: CaptureInfo = {
      template: template ? `${template.path ? bodyType : 'generic'}/${slot}/${effectiveMode}` : null,
      mode: effectiveMode,
      hfovDeg: deviceHfov,
      focal35: taken.focal35,
      rollDeg: horizonDeg(g),
      pitchDeg: tiltFromGravity(g).pitchDeg,
      targetBox: box ? [box.x0, box.y0, box.x1, box.y1] : null,
      simpleMode: simple,
      auto: autoTaken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceModel: Device.modelName,
      width: taken.width,
      height: taken.height,
    };
    return { taken, info };
  };

  return {
    permission,
    cameraProps: {
      ref: camera,
      device,
      outputs: [frameOutput, photoOutput],
      constraints: [{ resolutionBias: photoOutput }],
      zoom: device ? zoomFor(effectiveMode, device) : 1,
      isActive: active,
      // Photos and frames follow the locked landscape UI, not the sensor: a phone tilted down at a wheel must
      // not turn the photo into portrait.
      orientationSource: 'interface' as const,
      // Zoom set while the session is still starting (or paused) is rejected; the session starts at the same zoom anyway.
      onError: (error: Error) => {
        if (!/not active/i.test(error.message)) console.warn('[camera]', error.message);
      },
    },
    onPreviewLayout,
    template,
    scale,
    expected,
    mode: effectiveMode,
    setMode,
    wideAvailable: wideHere,
    guidance,
    simple,
    advice,
    autoCapture,
    setAutoCapture,
    detectorReady: model != null,
    capture,
  };
}
