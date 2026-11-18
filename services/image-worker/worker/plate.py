"""Plates (design 7.2.1, 7.2.8; M0 decision): RT-DETRv2 finds the box, a classical quad search in the box
grown by 15 % finds the corners (with the EU strip), every plate is covered before the photo goes to
Photoroom, and the gallery's banner is warped onto the target car's plate."""
import json
from pathlib import Path

import cv2
import numpy as np

Box = tuple[int, int, int, int]
PLATE_W, PLATE_H = 520, 110
MIN_RATIO, MAX_RATIO = 2.5, 6.5
GROW = 0.15


class PlateDetector:
    """justjuu/rtdetr-v2-license-plate-detection (Apache-2.0) as ONNX; see scripts/export_plate_onnx.py."""

    def __init__(self, model_path: str):
        import onnxruntime as ort

        self.session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.pre = json.loads((Path(model_path).parent / "plate_preprocess.json").read_text())

    def detect(self, image: np.ndarray) -> list[tuple[float, Box]]:
        """Plates scoring at least the M0 threshold (0.3), best first, as pixel boxes."""
        h, w = image.shape[:2]
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        x = cv2.resize(rgb, (self.pre["width"], self.pre["height"]), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        x *= self.pre["rescale"]
        if self.pre["normalize"]:
            x = (x - np.array(self.pre["mean"], np.float32)) / np.array(self.pre["std"], np.float32)
        logits, boxes = self.session.run(None, {"pixel_values": x.transpose(2, 0, 1)[None]})
        scores = 1 / (1 + np.exp(-logits[0, :, 0]))
        found = []
        for i in np.argsort(-scores):
            if scores[i] < self.pre["threshold"]:
                break
            cx, cy, bw, bh = boxes[0, i]
            found.append((float(scores[i]), (int(round((cx - bw / 2) * w)), int(round((cy - bh / 2) * h)),
                                             int(round((cx + bw / 2) * w)), int(round((cy + bh / 2) * h)))))
        return found


# --- corner search (ported from spikes/plate/classical.py, M0 Task 4) ---

def _order_corners(quad: np.ndarray) -> np.ndarray:
    """Top-left, top-right, bottom-right, bottom-left."""
    quad = quad.reshape(4, 2).astype(np.float32)
    c = quad.mean(axis=0)
    quad = quad[np.argsort(np.arctan2(quad[:, 1] - c[1], quad[:, 0] - c[0]))]
    return np.roll(quad, -int(np.argmin(quad.sum(axis=1))), axis=0)


def _quads(gray: np.ndarray) -> list[np.ndarray]:
    found = []
    block = max(11, (min(gray.shape) // 20) | 1)
    edges = [
        cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block, -5),
        cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, 5),
        cv2.dilate(cv2.Canny(gray, 50, 150), np.ones((3, 3), np.uint8)),
    ]
    for binary in edges:
        contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            if cv2.contourArea(cnt) < 50:
                continue
            peri = cv2.arcLength(cnt, True)
            for eps in (0.02, 0.04):
                approx = cv2.approxPolyDP(cnt, eps * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    found.append(_order_corners(approx))
                    break
    return found


def _score(image: np.ndarray, hsv: np.ndarray, quad: np.ndarray) -> float:
    dst = np.float32([[0, 0], [PLATE_W, 0], [PLATE_W, PLATE_H], [0, PLATE_H]])
    warped = cv2.warpPerspective(image, cv2.getPerspectiveTransform(quad.astype(np.float32), dst), (PLATE_W, PLATE_H))
    whsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
    body = whsv[10:-10, int(PLATE_W * 0.12):-10]
    bright = float(np.mean((body[..., 2] > 140) & (body[..., 1] < 70)))  # plate field: bright, unsaturated
    dark = float(np.mean(body[..., 2] < 90))  # characters
    text = 1.0 - abs(dark - 0.25) / 0.25 if dark < 0.5 else 0.0
    mask = np.zeros(image.shape[:2], np.uint8)
    cv2.fillConvexPoly(mask, quad.astype(np.int32), 255)
    ring = cv2.dilate(mask, np.ones((9, 9), np.uint8)) - mask
    v = hsv[..., 2]
    contrast = float(np.clip((v[mask > 0].mean() - v[ring > 0].mean()) / 80, 0, 1)) if ring.any() else 0.0
    strip = whsv[5:-5, : int(PLATE_W * 0.1)]
    blue = float(np.mean((strip[..., 0] >= 100) & (strip[..., 0] <= 130) & (strip[..., 1] > 80)))
    return 0.35 * bright + 0.2 * text + 0.2 * contrast + 0.25 * min(1.0, blue * 2)


def _extend_eu_strip(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """The white-field contour often stops at the blue EU strip; move the left edge over the strip."""
    left = 0.2
    tl, tr, br, bl = quad
    src = np.float32([tl - (tr - tl) * left, tr, br, bl - (br - bl) * left])
    width = int(PLATE_W * (1 + left))
    m = cv2.getPerspectiveTransform(src, np.float32([[0, 0], [width, 0], [width, PLATE_H], [0, PLATE_H]]))
    hsv = cv2.cvtColor(cv2.warpPerspective(image, m, (width, PLATE_H)), cv2.COLOR_BGR2HSV)
    blue = ((hsv[..., 0] >= 100) & (hsv[..., 0] <= 130) & (hsv[..., 1] > 80))[10:-10].mean(axis=0)
    outside = blue[: int(PLATE_W * left)]
    cols = np.nonzero(outside > 0.4)[0]
    if len(cols) < PLATE_W * 0.03:
        return quad
    share = (len(outside) - cols.min()) / PLATE_W
    return np.float32([tl - (tr - tl) * share, tr, br, bl - (br - bl) * share])


def refine_corners(image: np.ndarray, box: Box) -> np.ndarray:
    """(4, 2) corners clockwise from top-left: the best plate-like quad in the box grown by 15 %, else the box."""
    x0, y0, x1, y1 = box
    h, w = image.shape[:2]
    gx, gy = (x1 - x0) * GROW, (y1 - y0) * GROW
    rx0, ry0, rx1, ry1 = int(max(0, x0 - gx)), int(max(0, y0 - gy)), int(min(w, x1 + gx)), int(min(h, y1 + gy))
    box_corners = np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    roi = image[ry0:ry1, rx0:rx1]
    if roi.size == 0:
        return box_corners
    ref_area = (x1 - x0) * (y1 - y0) / 0.05  # the plate fills 20–100 % of the box (M0)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    best, best_score = None, 0.0
    for quad in _quads(cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)):
        area = cv2.contourArea(quad)
        if not (0.002 * ref_area <= area <= 0.05 * ref_area):
            continue
        qw = (np.linalg.norm(quad[1] - quad[0]) + np.linalg.norm(quad[2] - quad[3])) / 2
        qh = (np.linalg.norm(quad[3] - quad[0]) + np.linalg.norm(quad[2] - quad[1])) / 2
        if qh == 0 or not (MIN_RATIO <= qw / qh <= MAX_RATIO):
            continue
        quad = quad + np.float32([rx0, ry0])
        s = _score(image, hsv, quad)
        if s > best_score:
            best, best_score = quad, s
    return box_corners if best is None else _extend_eu_strip(image, best)


def cover_box(box: Box, w: int, h: int) -> Box | None:
    """The area `cover` paints over: the plate box grown by 10 % on each side, inside the image."""
    x0, y0, x1, y1 = box
    gx, gy = (x1 - x0) * 0.1, (y1 - y0) * 0.1
    bx0, by0, bx1, by1 = int(max(0, x0 - gx)), int(max(0, y0 - gy)), int(min(w, x1 + gx)), int(min(h, y1 + gy))
    return None if bx1 <= bx0 or by1 <= by0 else (bx0, by0, bx1, by1)


def cover(image: np.ndarray, boxes: list[Box]) -> np.ndarray:
    """Makes every found plate unreadable before the photo leaves for Photoroom."""
    out = image.copy()
    h, w = out.shape[:2]
    for box in boxes:
        grown = cover_box(box, w, h)
        if grown is None:
            continue
        bx0, by0, bx1, by1 = grown
        region = out[by0:by1, bx0:bx1]
        out[by0:by1, bx0:bx1] = np.broadcast_to(region.reshape(-1, 3).mean(axis=0).astype(np.uint8), region.shape)
    return out


def restore_covered(alpha: np.ndarray, boxes: list[Box]) -> np.ndarray:
    """Puts covered plates back into the car mask. The flat cover often reads as background to Photoroom
    (a bright plate on a dark car), which leaves a hole or a notch and hides the plate from pick_target.
    Inside each covered box a pixel is filled only when there is car on both sides of it, along its row or
    its column, within a ring around the box: holes and notches close, the car's outline never grows, and
    a plate on another car, with no car around it, stays out."""
    out = alpha.copy()
    h, w = out.shape
    for box in boxes:
        grown = cover_box(box, w, h)
        if grown is None:
            continue
        bx0, by0, bx1, by1 = grown
        t = max(3, (by1 - by0) // 2)
        rx0, ry0, rx1, ry1 = max(0, bx0 - t), max(0, by0 - t), min(w, bx1 + t), min(h, by1 + t)
        car = alpha[ry0:ry1, rx0:rx1] >= 128
        rows = np.logical_or.accumulate(car, axis=1) & np.logical_or.accumulate(car[:, ::-1], axis=1)[:, ::-1]
        cols = np.logical_or.accumulate(car, axis=0) & np.logical_or.accumulate(car[::-1], axis=0)[::-1]
        between = (rows | cols)[by0 - ry0:by1 - ry0, bx0 - rx0:bx1 - rx0]
        out[by0:by1, bx0:bx1][between] = 255
    return out


def pick_target(plates: list[tuple[float, Box]], alpha: np.ndarray) -> Box | None:
    """The best-scoring plate lying more than half on the target car's mask."""
    best = None
    for score, (x0, y0, x1, y1) in plates:
        on_car = alpha[max(0, y0):y1, max(0, x0):x1]
        if on_car.size and (on_car > 127).mean() > 0.5 and (best is None or score > best[0]):
            best = (score, (x0, y0, x1, y1))
    return None if best is None else best[1]


def warp_banner(canvas: np.ndarray, banner_rgba: np.ndarray, corners: np.ndarray, clip: np.ndarray | None = None) -> np.ndarray:
    """The gallery's banner warped onto the four plate corners (homography) and alpha-blended. With `clip`
    (the car's alpha on the canvas) it never reaches past the car, e.g. a plate found at a side view's edge."""
    bh, bw = banner_rgba.shape[:2]
    m = cv2.getPerspectiveTransform(np.float32([[0, 0], [bw, 0], [bw, bh], [0, bh]]), np.float32(corners))
    size = (canvas.shape[1], canvas.shape[0])
    color = cv2.warpPerspective(banner_rgba[..., :3], m, size, flags=cv2.INTER_LINEAR)
    alpha = cv2.warpPerspective(banner_rgba[..., 3], m, size, flags=cv2.INTER_LINEAR).astype(np.float32)[..., None] / 255
    if clip is not None:
        alpha *= clip.astype(np.float32)[..., None] / 255
    return np.clip(color * alpha + canvas * (1 - alpha), 0, 255).astype(np.uint8)
