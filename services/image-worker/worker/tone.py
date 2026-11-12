"""Tone correction (design 7.2.7): each photo's car is pulled part of the way toward the set's own median
brightness and colour, never toward a fixed value, so a black car stays black and a red car red.
Limited: gain 0.8–1.25 on L*, at most ±6 on a* and b*."""
import cv2
import numpy as np

STRENGTH = 0.5
IDENTITY = {"gain": 1.0, "da": 0.0, "db": 0.0}


def _lab(image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab[..., 0] *= 100 / 255
    lab[..., 1:] -= 128
    return lab


def measure(image: np.ndarray, alpha: np.ndarray) -> dict:
    """Mean L*, a*, b* of the car (mask > 127), ignoring clipped highlights (L* > 97)."""
    lab = _lab(image)
    use = (alpha > 127) & (lab[..., 0] <= 97)
    if not use.any():
        use = alpha > 127
    if not use.any():
        return {"L": 0.0, "a": 0.0, "b": 0.0}
    return {k: float(lab[..., i][use].mean()) for i, k in enumerate(("L", "a", "b"))}


def set_target(stats: list[dict]) -> dict | None:
    if not stats:
        return None
    return {k: float(np.median([s[k] for s in stats])) for k in ("L", "a", "b")}


def correction(stats: dict, target: dict, strength: float = STRENGTH) -> dict:
    gain = (stats["L"] + strength * (target["L"] - stats["L"])) / stats["L"] if stats["L"] > 0 else 1.0
    return {
        "gain": float(np.clip(gain, 0.8, 1.25)),
        "da": float(np.clip(strength * (target["a"] - stats["a"]), -6, 6)),
        "db": float(np.clip(strength * (target["b"] - stats["b"]), -6, 6)),
    }


def mean_correction(corrections: list[dict]) -> dict:
    """For detail and interior photos: the set's average exterior correction."""
    if not corrections:
        return dict(IDENTITY)
    return {k: float(np.mean([c[k] for c in corrections])) for k in ("gain", "da", "db")}


def apply(image: np.ndarray, corr: dict, alpha: np.ndarray | None = None) -> np.ndarray:
    lab = _lab(image)
    lab[..., 0] = np.clip(lab[..., 0] * corr["gain"], 0, 100)
    lab[..., 1] += corr["da"]
    lab[..., 2] += corr["db"]
    lab[..., 0] *= 255 / 100
    lab[..., 1:] += 128
    out = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    if alpha is None:
        return out
    a = (alpha.astype(np.float32) / 255)[..., None]
    return np.clip(out * a + image * (1 - a), 0, 255).astype(np.uint8)
