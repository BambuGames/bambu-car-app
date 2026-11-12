"""Putting the placed car on its background (design 7.2.4–7.2.6, 7.2.10)."""
import cv2
import numpy as np

SHADOW_MAX = 0.45


def warp(image: np.ndarray, matrix: np.ndarray, out_size: tuple[int, int]) -> np.ndarray:
    return cv2.warpAffine(image, matrix, out_size, flags=cv2.INTER_LINEAR, borderValue=0)


def contact_shadow(alpha_out: np.ndarray) -> np.ndarray:
    """A synthetic contact shadow from the mask: the bottom 12 % of the car squashed to a quarter of its
    height under the car's lowest row, blurred by 1.5 % of the car's width. 0–1, at most 0.45, and nothing
    more than 3 % of the car's height above its bottom (the floor there is open, not under the car)."""
    shadow = np.zeros(alpha_out.shape, np.float32)
    ys, xs = np.nonzero(alpha_out >= 128)
    if len(xs) == 0:
        return shadow
    top, bottom = ys.min(), ys.max() + 1
    car_h, car_w = bottom - top, xs.max() + 1 - xs.min()
    band_h = max(1, int(0.12 * car_h))
    band = (alpha_out[bottom - band_h:bottom] >= 128).astype(np.float32)
    squashed = cv2.resize(band, (band.shape[1], max(1, band_h // 4)), interpolation=cv2.INTER_AREA)
    start = bottom - squashed.shape[0] // 2
    end = min(shadow.shape[0], start + squashed.shape[0])
    shadow[start:end] = squashed[: end - start]
    sigma = max(1.0, 0.015 * car_w)
    shadow = cv2.GaussianBlur(shadow, (0, 0), sigma)
    shadow[: bottom - int(0.03 * car_h)] = 0
    peak = shadow.max()
    return shadow * (SHADOW_MAX / peak) if peak > 0 else shadow


def compose(background: np.ndarray, car: np.ndarray, alpha: np.ndarray, shadow: np.ndarray) -> np.ndarray:
    a = (alpha.astype(np.float32) / 255)[..., None]
    floor = background.astype(np.float32) * (1 - shadow[..., None])
    return np.clip(car.astype(np.float32) * a + floor * (1 - a), 0, 255).astype(np.uint8)


def encode_jpeg(image: np.ndarray, quality: int = 90) -> bytes:
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("jpeg encoding failed")
    return data.tobytes()
