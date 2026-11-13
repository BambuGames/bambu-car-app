"""Backgrounds (design 7.2.5), seen by the template camera: 1 m high, level, 69°, so the horizon is the
middle row and a car placed on its template box stands on the floor at the right scale."""
from typing import Callable

import cv2
import numpy as np

OUT_SIZE = (2560, 1920)


def _bgr(hex_color: str) -> np.ndarray:
    h = hex_color.lstrip("#")
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32)


def _smooth(edge0: float, edge1: float, y: np.ndarray) -> np.ndarray:
    t = np.clip((y - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def render_background(spec: dict, size: tuple[int, int] = OUT_SIZE,
                      load_image: Callable[[str], np.ndarray] | None = None) -> np.ndarray:
    w, h = size
    if spec.get("kind") == "image":
        image = load_image(spec["path"])
        ih, iw = image.shape[:2]
        crop_w, crop_h = min(iw, ih * w // h), min(ih, iw * h // w)  # cover: crop to 4:3, centred
        x, y = (iw - crop_w) // 2, (ih - crop_h) // 2
        return cv2.resize(image[y:y + crop_h, x:x + crop_w], (w, h), interpolation=cv2.INTER_AREA)

    # Seamless studio: wall above the horizon, floor below, joined over 8 % of the height. The floor is up to
    # 6 % darker where it meets the wall and lightens slowly all the way to the camera, as on a lit cyclorama:
    # no row steps by more than a level, and no darker stripe behind the car.
    wall, floor = _bgr(spec["wall"]), _bgr(spec["floor"])
    y = (np.arange(h, dtype=np.float32) + 0.5) / h
    t = _smooth(0.46, 0.54, y)
    recede = 1 - 0.06 * _smooth(0.47, 0.52, y) * (1 - _smooth(0.52, 1.0, y))
    column = wall[None, :] * (1 - t)[:, None] + floor[None, :] * (t * recede)[:, None]
    return np.repeat(np.clip(column, 0, 255).astype(np.uint8)[:, None, :], w, axis=1)
