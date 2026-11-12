"""Watermark (design 7.2.9): the gallery logo at a chosen position, size and opacity, optionally inside a
corporate band at the top or bottom. Settings and defaults: galleries.watermark (processing migration)."""
import cv2
import numpy as np

DEFAULTS = {"position": "bottom_right", "width": 0.18, "opacity": 0.85, "band": None}
MARGIN = 0.03  # of the image width


def _bgr(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)


def _paste(canvas: np.ndarray, logo: np.ndarray, x: int, y: int, opacity: float) -> None:
    h, w = logo.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(canvas.shape[1], x + w), min(canvas.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return
    part = logo[y0 - y:y1 - y, x0 - x:x1 - x]
    a = (part[..., 3:4].astype(np.float32) / 255) * opacity
    region = canvas[y0:y1, x0:x1].astype(np.float32)
    canvas[y0:y1, x0:x1] = np.clip(part[..., :3] * a + region * (1 - a), 0, 255).astype(np.uint8)


def apply_watermark(canvas: np.ndarray, logo_rgba: np.ndarray | None, settings: dict) -> np.ndarray:
    s = {**DEFAULTS, **{k: v for k, v in (settings or {}).items() if v is not None}}
    out = canvas.copy()
    h, w = out.shape[:2]
    band = s.get("band")
    band_y0 = band_y1 = None
    if band:
        band_h = int(round(float(np.clip(band.get("height", 0.08), 0.04, 0.15)) * h))
        band_y0, band_y1 = (0, band_h) if band.get("edge") == "top" else (h - band_h, h)
        out[band_y0:band_y1] = _bgr(band.get("color", "#000000"))
    if logo_rgba is None:
        return out

    logo_w = int(round(float(np.clip(s["width"], 0.05, 0.4)) * w))
    logo_h = max(1, int(round(logo_w * logo_rgba.shape[0] / logo_rgba.shape[1])))
    if band:  # the logo fits inside the band
        max_h = int(0.7 * (band_y1 - band_y0))
        if logo_h > max_h:
            logo_w, logo_h = max(1, int(round(logo_w * max_h / logo_h))), max_h
    logo = cv2.resize(logo_rgba, (logo_w, logo_h), interpolation=cv2.INTER_AREA)
    margin = int(round(MARGIN * w))
    position = s["position"]
    if position == "center":
        x = (w - logo_w) // 2
    elif position.endswith("left"):
        x = margin
    else:
        x = w - margin - logo_w
    if band:
        y = band_y0 + (band_y1 - band_y0 - logo_h) // 2
    elif position == "center":
        y = (h - logo_h) // 2
    elif position.startswith("top"):
        y = margin
    else:
        y = h - margin - logo_h
    _paste(out, logo, x, y, float(np.clip(s["opacity"], 0, 1)))
    return out
