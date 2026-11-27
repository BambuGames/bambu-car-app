"""Putting the placed car on its background (design 7.2.4–7.2.6, 7.2.10)."""
import cv2
import numpy as np

CONTACT = 0.85  # under a tyre
UNDER_NEAR, UNDER_FAR = 0.42, 0.22  # the floor under the body: next to the sill, at the ground line
PENUMBRA = 0.22
SHADOW_CAP = 0.9
FAR = 1e6  # a row no pixel reaches: columns outside the car


def warp(image: np.ndarray, matrix: np.ndarray, out_size: tuple[int, int]) -> np.ndarray:
    return cv2.warpAffine(image, matrix, out_size, flags=cv2.INTER_LINEAR, borderValue=0)


def _blur(layer: np.ndarray, sigma: float) -> np.ndarray:
    return cv2.GaussianBlur(layer.astype(np.float32), (0, 0), sigma, borderType=cv2.BORDER_CONSTANT)


def _lower_hull(ybot: np.ndarray) -> np.ndarray:
    """The ground line: the convex hull of the outline's bottom points from below (image y grows down),
    interpolated over every column. The tyres stand on it, in every view."""
    hull: list[tuple[int, float]] = []
    for x, y in enumerate(ybot):
        while len(hull) >= 2 and ((hull[-1][0] - hull[-2][0]) * (y - hull[-2][1])
                                  - (hull[-1][1] - hull[-2][1]) * (x - hull[-2][0])) >= 0:
            hull.pop()
        hull.append((x, float(y)))
    return np.interp(np.arange(len(ybot)), [p[0] for p in hull], [p[1] for p in hull]).astype(np.float32)


def contact_shadow(alpha_out: np.ndarray) -> np.ndarray:
    """The car's shadow on the floor, from its lower outline (the last car row in each column), 0–0.9:
    - contact: dark and thin under the tyres, i.e. where the outline sits on the ground line (the lower hull)
      and is the lowest point around it, so a bumper end is not taken for a tyre;
    - under the body: the floor between the outline and the ground line, darker next to the sill;
    - penumbra: wide and soft below the ground line.
    The car covers whatever lands above its outline."""
    hgt, wid = alpha_out.shape
    shadow = np.zeros((hgt, wid), np.float32)
    a = alpha_out >= 128
    cols = np.flatnonzero(a.any(axis=0))
    if cols.size == 0:
        return shadow
    rows = np.flatnonzero(a.any(axis=1))
    car_h, car_w = float(rows[-1] - rows[0] + 1), float(cols[-1] - cols[0] + 1)
    x0, x1 = int(cols[0]), int(cols[-1]) + 1
    sub = a[:, x0:x1]
    ybot = (hgt - 1 - np.argmax(sub[::-1], axis=0)).astype(np.float32)
    present = sub.any(axis=0)
    if not present.all():  # a gap inside the car's span: bridge it from the neighbours
        ybot = np.interp(np.arange(x1 - x0), np.flatnonzero(present), ybot[present]).astype(np.float32)
    ground = _lower_hull(ybot)
    gap = np.clip(ground - ybot, 0, None)
    window = max(3, int(0.3 * car_w)) | 1  # ±15 % of the car's width
    lowest_near = cv2.dilate(ybot[None, :], np.ones((1, window), np.uint8))[0]
    # A tyre meets the ground line in a single pixel; its neighbours sit a pixel or two higher. Treat
    # 1 % of the car's height as touching, then fade over 1.5 %.
    contact_w = np.exp(-np.clip(gap - 0.01 * car_h, 0, None) / (0.015 * car_h)) * (ybot >= lowest_near - 0.04 * car_h)
    # Column weights switch on and off from one column to the next; smoothed sideways so the thin contact
    # layer has no hard vertical edges (it is blurred only a little).
    sigma_w = max(1.0, 0.006 * car_w)
    k = 2 * int(np.ceil(3 * sigma_w)) + 1
    contact_w = cv2.GaussianBlur(contact_w[None, :].astype(np.float32), (k, 1), sigma_w, sigmaY=0,
                                 borderType=cv2.BORDER_CONSTANT)[0]  # sideways only: (k, 1)

    s_contact, s_under, s_pen = max(1.0, 0.0015 * car_w), max(1.0, 0.007 * car_w), max(1.0, 0.025 * car_w)
    pad = int(3 * s_pen) + 1
    # high enough that no layer's blur is cut off: the penumbra starts above the ground line and spreads widest
    top = max(0, int(min(ybot.min() - 3 * s_under, ground.min() - 0.02 * car_h - 3 * s_pen)) - 2)
    bottom = min(hgt, int(ground.max() + 0.25 * car_h) + pad)
    left, right = max(0, x0 - pad), min(wid, x1 + pad)

    def widen(v: np.ndarray, fill: float) -> np.ndarray:
        out = np.full(right - left, fill, np.float32)
        out[x0 - left:x1 - left] = v
        return out

    yb, gr, cw = widen(ybot, FAR), widen(ground, FAR), widen(contact_w, 0.0)
    yy = np.arange(top, bottom, dtype=np.float32)[:, None]
    below = np.clip(yy - gr, 0, None)
    # Both layers reach up into the car by their blur radius: the car hides that part, and the blur then has
    # shadow, not empty floor, above the outline to mix in.
    contact = CONTACT * np.exp(-below / (0.03 * car_h)) * (yy >= yb - 3 * s_contact) * cw
    depth = np.clip((gr - yy) / np.maximum(gr - yb, 1), 0, 1)  # 1 at the sill, 0 at the ground line
    under = ((yy >= yb - 3 * s_under) & (yy <= gr + 0.01 * car_h)) * (UNDER_FAR + (UNDER_NEAR - UNDER_FAR) * depth)
    pen = np.exp(-below / (0.035 * car_h)) * (yy >= gr - 0.02 * car_h)
    s = np.maximum(_blur(contact, s_contact), _blur(under, s_under))
    s = np.maximum(s, PENUMBRA * _blur(pen, s_pen))
    shadow[top:bottom, left:right] = np.clip(s, 0, SHADOW_CAP)
    return shadow


def compose(background: np.ndarray, car: np.ndarray, alpha: np.ndarray, shadow: np.ndarray) -> np.ndarray:
    a = (alpha.astype(np.float32) / 255)[..., None]
    floor = background.astype(np.float32) * (1 - shadow[..., None])
    return np.clip(car.astype(np.float32) * a + floor * (1 - a), 0, 255).astype(np.uint8)


def encode_jpeg(image: np.ndarray, quality: int = 90) -> bytes:
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("jpeg encoding failed")
    return data.tobytes()
