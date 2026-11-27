"""White balance (design 2026-11-26): a strong colour cast, such as yellow garage light, is read from the car's
surroundings and the car is pulled part of the way toward neutral light. Only near-neutral surroundings count
(concrete, asphalt, walls), so a red brick wall does not tint a white car, and vegetation is left out: sunlit
grass and leaves would read as a warm cast. A photo in daylight gets no gains.
Switched with the gallery's colour matching (tone_enabled)."""
import cv2
import numpy as np

ESTIMATE_SIDE = 1024  # the light is read from a copy at most this long: the average needs no 12 MP
MARGIN_PX = 15  # around the car mask (full size), left out of the estimate
MAX_SATURATION = 0.6  # HSV, 0–1
LUMA_RANGE = (30, 240)  # HSV value: no deep shadows, no clipped highlights
MIN_SHARE = 0.10  # of the photo, or no estimate
GREYEST_SHARE = 25  # % of the candidates, least saturated first: a real cast tints even the greyest
# surfaces, a beige wall does not tint the pavement
TRIM = (10, 90)  # percentiles kept per channel
GREEN_HUES = (30, 90)  # OpenCV hue (0–180): yellow-green to cyan, i.e. vegetation
GREEN_MIN_SATURATION = 50  # 0–255: grey surfaces keep counting
THRESHOLD = 0.06  # largest raw deviation that still counts as neutral light (M0: daylight ≤ 0.039, garage 0.07–0.26)
STRENGTH = 0.75
LIMITS = (0.75, 1.33)
LUMA_WEIGHTS = np.array([0.114, 0.587, 0.299], np.float32)  # BGR


def estimate_gains(image: np.ndarray, alpha: np.ndarray) -> list[float] | None:
    """Per-channel gains (BGR) that keep the brightness, or None when the light is near neutral or too little
    of the surroundings is near-neutral to tell."""
    scale = min(1.0, ESTIMATE_SIDE / max(image.shape[:2]))
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        alpha = cv2.resize(alpha, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_AREA)
    k = 2 * max(1, round(MARGIN_PX * scale)) + 1
    outside = cv2.dilate((alpha > 127).astype(np.uint8), np.ones((k, k), np.uint8)) == 0
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hue, sat, value = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    green = (hue >= GREEN_HUES[0]) & (hue <= GREEN_HUES[1]) & (sat > GREEN_MIN_SATURATION)
    use = outside & ~green & (sat < MAX_SATURATION * 255) & (value >= LUMA_RANGE[0]) & (value <= LUMA_RANGE[1])
    if use.mean() < MIN_SHARE:
        return None
    use &= sat <= np.percentile(sat[use], GREYEST_SHARE)
    pixels = image[use].astype(np.float32)
    lo, hi = np.percentile(pixels, TRIM, axis=0)
    means = np.array([pixels[(pixels[:, c] >= lo[c]) & (pixels[:, c] <= hi[c]), c].mean() for c in range(3)],
                     np.float32)
    gains = means.mean() / np.maximum(means, 1.0)
    if np.abs(gains - 1).max() < THRESHOLD:
        return None
    gains = np.clip(1 + STRENGTH * (gains - 1), *LIMITS)
    gains /= float(LUMA_WEIGHTS @ gains)
    return [float(g) for g in gains]


def apply_gains(image: np.ndarray, gains: list[float] | None) -> np.ndarray:
    if gains is None:
        return image
    return cv2.transform(image, np.diag(np.array(gains, np.float32)))  # stays uint8, saturates at 255
