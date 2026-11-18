"""Geometry on the upright original (design 7.2.2–7.2.4): EXIF, horizon, which mask parts are the target
car, touch-up edits, and where the car lands in the output. Images are BGR uint8, alphas uint8 0–255."""
import io
import math

import cv2
import numpy as np
from PIL import Image, ImageOps

IDENTITY = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
MAX_ROLL_DEG = 20  # beyond this the stored tilt is not a hand-held wobble (e.g. a phone held upright);
# the capture screen is locked to landscape, and round 1 had 11–13° shots left unlevelled at 10
OUT_SIZE = (2560, 1920)


def load_upright(jpeg: bytes) -> np.ndarray:
    """Decodes a JPEG as shown: Android writes the rotation into EXIF instead of turning the pixels."""
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(jpeg))).convert("RGB")
    return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)


def straighten(image: np.ndarray, alpha: np.ndarray | None, roll_deg: float | None):
    """Levels the horizon. roll_deg > 0: the horizon rises to the right (the app's horizonDeg), so the
    picture turns clockwise by that much. Returns the image, the alpha and the 2×3 matrix used."""
    if roll_deg is None or abs(roll_deg) > MAX_ROLL_DEG or roll_deg == 0:
        return image, alpha, IDENTITY.copy()
    h, w = image.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), -roll_deg, 1.0)  # OpenCV turns positive angles anticlockwise
    out = cv2.warpAffine(image, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    out_alpha = None if alpha is None else cv2.warpAffine(alpha, m, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
    return out, out_alpha, m


def _components(alpha: np.ndarray):
    return cv2.connectedComponentsWithStats((alpha >= 128).astype(np.uint8), connectivity=8)


def _keep(alpha: np.ndarray, labels: np.ndarray, keep: list[int]) -> np.ndarray:
    # Soft mask edges sit just outside the binary parts; keep the 3 px around what stays.
    mask = cv2.dilate(np.isin(labels, keep).astype(np.uint8), np.ones((7, 7), np.uint8))
    return alpha * mask


def solid(alpha: np.ndarray) -> np.ndarray:
    """The car's outer outline, filled: holes left inside the mask (an uncovered plate) count as car, nothing
    outside does. The banner is clipped to this, so it never reaches past the car and never gets cut by a hole."""
    contours, _ = cv2.findContours((alpha >= 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = np.zeros_like(alpha)
    cv2.drawContours(out, contours, -1, 255, thickness=cv2.FILLED)
    return out


def keep_target(alpha: np.ndarray, target_box: tuple[float, float, float, float] | None) -> np.ndarray:
    """Keeps the part with the most pixels inside the target car's detection box, plus other parts lying at
    least half inside it (a mirror or a piece cut off by the mask), without cropping to the box: M0 showed it
    often misses the car's ends and antenna, which hang on the main part. Spec 7.2.2 keeps every part that
    touches the box; phone round 1 showed that keeps a parked neighbour reaching into it, so a part mostly
    outside is dropped. Without a box (simple mode) the largest part whose centre lies in the middle 60 % of
    the photo, else the largest part."""
    n, labels, stats, centroids = _components(alpha)
    if n <= 1:
        return np.zeros_like(alpha)
    h, w = alpha.shape
    parts = range(1, n)
    keep: list[int] = []
    if target_box is not None:
        bx0, by0 = max(0, math.floor(target_box[0] * w)), max(0, math.floor(target_box[1] * h))
        bx1, by1 = min(w, math.ceil(target_box[2] * w)), min(h, math.ceil(target_box[3] * h))
        inside = np.bincount(labels[by0:by1, bx0:bx1].ravel(), minlength=n) if bx1 > bx0 and by1 > by0 else np.zeros(n, int)
        if inside[1:].any():
            main = 1 + int(np.argmax(inside[1:]))
            keep = [main] + [i for i in parts if i != main and inside[i] >= 0.5 * stats[i, cv2.CC_STAT_AREA]]
    if not keep:
        central = [i for i in parts if 0.2 * w <= centroids[i][0] <= 0.8 * w and 0.2 * h <= centroids[i][1] <= 0.8 * h]
        keep = [max(central or parts, key=lambda i: stats[i, cv2.CC_STAT_AREA])]
    return _keep(alpha, labels, keep)


def apply_edits(alpha: np.ndarray, edits: list[dict]) -> np.ndarray:
    """Touch-up (M0 decision): erase strokes and removed pieces, in 0–1 coordinates of the upright original.
    Replayed on the stored Photoroom mask at every render, so the API is never called again."""
    out = alpha.copy()
    h, w = out.shape
    for edit in edits:
        if edit.get("type") == "erase" and edit.get("points"):
            pts = np.array([[p[0] * w, p[1] * h] for p in edit["points"]], np.int32)
            thickness = max(1, int(round(2 * edit.get("radius", 0.01) * w)))
            if len(pts) == 1:
                cv2.circle(out, tuple(int(v) for v in pts[0]), thickness // 2, 0, -1)
            else:
                cv2.polylines(out, [pts], False, 0, thickness)
        elif edit.get("type") == "remove" and edit.get("point"):
            n, labels, stats, _ = _components(out)
            if n <= 1:
                continue
            x = min(w - 1, max(0, int(edit["point"][0] * w)))
            y = min(h - 1, max(0, int(edit["point"][1] * h)))
            label = labels[y, x]
            car = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            if label not in (0, car):
                piece = cv2.dilate((labels == label).astype(np.uint8), np.ones((5, 5), np.uint8))
                out[piece > 0] = 0
    return out


def bbox(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    """(x0, y0, x1, y1) with exclusive ends, or None for an empty mask."""
    ys, xs = np.nonzero(alpha >= 128)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def placement(car_bbox: tuple[int, int, int, int], box: tuple[float, float, float, float],
              out_size: tuple[int, int] = OUT_SIZE) -> np.ndarray:
    """2×3 matrix: the car's width fills the template box's width and its bottom centre (the wheels on the
    ground) sits on the box's bottom centre."""
    x0, y0, x1, y1 = car_bbox
    out_w, out_h = out_size
    s = (box[2] - box[0]) * out_w / (x1 - x0)
    tx = (box[0] + box[2]) / 2 * out_w - s * (x0 + x1) / 2
    ty = box[3] * out_h - s * y1
    return np.array([[s, 0.0, tx], [0.0, s, ty]])
