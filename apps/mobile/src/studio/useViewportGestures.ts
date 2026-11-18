// Two-finger zoom and pan for the photo editors (phone round 1): pinch zooms around the fingers, a two-finger drag
// moves the photo. One-finger gestures stay with each editor (corner drag, brush, tap); they reset `zoomed` when
// a finger comes down and drop their result once it is set, so a stroke or tap that turns into a pinch (a second
// finger landing late, which iOS does not cancel) leaves nothing behind.
import { useRef, useState } from 'react';
import { usePanGesture, usePinchGesture } from 'react-native-gesture-handler';

import { panBy, zoomAt, type View } from './viewport';

export function useViewportGestures(initial: View, size: { width: number; height: number }) {
  const [view, setView] = useState(initial);
  const zoomed = useRef(false);
  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: () => {
      zoomed.current = true;
    },
    onUpdate: (e) => {
      if (size.width === 0) return;
      setView((v) => zoomAt(v, { x: e.focalX / size.width, y: e.focalY / size.height }, e.scaleChange));
    },
  });
  const pan = usePanGesture({
    runOnJS: true,
    minPointers: 2,
    onActivate: () => {
      zoomed.current = true;
    },
    onUpdate: (e) => {
      if (size.width === 0) return;
      setView((v) => panBy(v, e.changeX / size.width, e.changeY / size.height));
    },
  });
  return { view, pinch, pan, zoomed };
}
