"""Backgrounds (design 7.2.5), seen by the template camera: 1 m high, level, 69°, so the horizon is the
middle row and a car placed on its template box stands on the floor at the right scale."""
from typing import Callable

import cv2
import numpy as np

OUT_SIZE = (2560, 1920)


def _bgr(hex_color: str) -> np.ndarray:
    h = hex_color.lstrip("#")
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32)


def render_background(spec: dict, size: tuple[int, int] = OUT_SIZE,
                      load_image: Callable[[str], np.ndarray] | None = None) -> np.ndarray:
    w, h = size
    if spec.get("kind") == "image":
        image = load_image(spec["path"])
        ih, iw = image.shape[:2]
        crop_w, crop_h = min(iw, ih * w // h), min(ih, iw * h // w)  # cover: crop to 4:3, centred
        x, y = (iw - crop_w) // 2, (ih - crop_h) // 2
        return cv2.resize(image[y:y + crop_h, x:x + crop_w], (w, h), interpolation=cv2.INTER_AREA)

    # Seamless studio: wall above the horizon, floor below, a soft 4 % seam, the floor a little darker
    # for 6 % below the horizon where it recedes.
    wall, floor = _bgr(spec["wall"]), _bgr(spec["floor"])
    y = (np.arange(h, dtype=np.float32) + 0.5) / h
    t = np.clip((y - 0.48) / 0.04, 0, 1)
    t = t * t * (3 - 2 * t)
    recede = 1 - 0.06 * np.clip(1 - (y - 0.5) / 0.06, 0, 1) * (y >= 0.5)
    column = wall[None, :] * (1 - t)[:, None] + floor[None, :] * (t * recede)[:, None]
    return np.repeat(np.clip(column, 0, 255).astype(np.uint8)[:, None, :], w, axis=1)
