"""Showroom backgrounds (design 2026-11-26): a fixed room around the parked car, drawn from each slot's
template camera (1 m high, 69°, the body type's distance and centering yaw), so the room turns with the shooting
angle and the floor meets the car where the template placed it. World axes as tools/templates: the car's
centre on the ground at the origin, +x its front, +y its left, +z up. Floor tiles run along the car.

Drawn at half size and scaled up; each (spec, body type, slot, pitch) is drawn once per worker."""
import json
from functools import lru_cache

import cv2
import numpy as np

from worker.backgrounds import OUT_SIZE
from worker.templates import SLOT_AZIMUTH, template_camera

HFOV_DEG = 69.0
CAMERA_HEIGHT_M = 1.0
MAX_PITCH_DEG = 20.0  # the capture check's tilt limit
DRAW_SIZE = (1280, 960)
ROOM = {"x0": -7.5, "x1": 8.5, "y0": -6.5, "y1": 7.0, "ceiling": 4.2, "tile": 0.8, "joint": 0.006}
WALL_SHADE = {"x0": 0.97, "x1": 1.00, "y0": 0.94, "y1": 0.99}  # light from the car's front-left
FLOOR, WALL, CEILING = 0, 1, 2
FAR = np.float32(1e9)


def _bgr(hex_color: str) -> np.ndarray:
    h = hex_color.lstrip("#")
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32) / 255


def _focal(width: int) -> float:
    return (width / 2) / np.tan(np.radians(HFOV_DEG) / 2)


def _rays(distance_m: float, azimuth_deg: float, yaw_deg: float, pitch_deg: float, size: tuple[int, int]):
    """Camera position and one world direction per pixel; the basis is templates.py _to_camera's, then turned
    down by the pitch (positive looks down)."""
    w, h = size
    a, y, p = np.radians(azimuth_deg), np.radians(yaw_deg), np.radians(pitch_deg)
    cam = np.array([distance_m * np.cos(a), distance_m * np.sin(a), CAMERA_HEIGHT_M], np.float32)
    fwd = np.array([-np.cos(a), -np.sin(a), 0.0])
    right = np.array([-np.sin(a), np.cos(a), 0.0])
    down = np.array([0.0, 0.0, -1.0])
    right, fwd = np.cos(y) * right - np.sin(y) * fwd, np.cos(y) * fwd + np.sin(y) * right
    fwd, down = np.cos(p) * fwd + np.sin(p) * down, np.cos(p) * down - np.sin(p) * fwd
    f = _focal(w)
    u = ((np.arange(w, dtype=np.float32) + 0.5 - w / 2) / f)[None, :, None]
    v = ((np.arange(h, dtype=np.float32) + 0.5 - h / 2) / f)[:, None, None]
    d = u * right.astype(np.float32) + v * down.astype(np.float32) + fwd.astype(np.float32)
    return cam, d


def _wall_hit(px, py, dx, dy):
    """Distance along (dx, dy) from (px, py) to the room's side walls, and which wall: 0 x0, 1 x1, 2 y0, 3 y1."""
    with np.errstate(divide="ignore", invalid="ignore"):
        tx = np.where(dx > 0, (ROOM["x1"] - px) / dx, np.where(dx < 0, (ROOM["x0"] - px) / dx, FAR))
        ty = np.where(dy > 0, (ROOM["y1"] - py) / dy, np.where(dy < 0, (ROOM["y0"] - py) / dy, FAR))
    which = np.where(tx <= ty, np.where(dx > 0, 1, 0), np.where(dy > 0, 3, 2))
    return np.minimum(tx, ty).astype(np.float32), which


def _trace(distance_m, azimuth_deg, yaw_deg, pitch_deg, size):
    cam, d = _rays(distance_m, azimuth_deg, yaw_deg, pitch_deg, size)
    dx, dy, dz = d[..., 0], d[..., 1], d[..., 2]
    t_wall, which = _wall_hit(cam[0], cam[1], dx, dy)
    with np.errstate(divide="ignore", invalid="ignore"):
        tz = np.where(dz < 0, -cam[2] / dz, np.where(dz > 0, (ROOM["ceiling"] - cam[2]) / dz, FAR))
    t = np.minimum(t_wall, tz)
    surface = np.full(dx.shape, WALL, np.int8)
    surface[(tz <= t_wall) & (dz < 0)] = FLOOR
    surface[(tz <= t_wall) & (dz > 0)] = CEILING
    return cam, d, t, surface, which


def trace(distance_m: float, azimuth_deg: float, yaw_deg: float, pitch_deg: float, size: tuple[int, int]) -> dict:
    """What each pixel sees: surface (0 floor, 1 wall, 2 ceiling) and the world point x, y, z in metres."""
    cam, d, t, surface, _ = _trace(distance_m, azimuth_deg, yaw_deg, pitch_deg, size)
    return {"surface": surface, "x": cam[0] + t * d[..., 0], "y": cam[1] + t * d[..., 1], "z": cam[2] + t * d[..., 2]}


def _wall_colour(base: np.ndarray, which: np.ndarray, px, py, pz) -> np.ndarray:
    """Colours (n, 3) for n wall points, given flat arrays."""
    shade = np.array([WALL_SHADE[k] for k in ("x0", "x1", "y0", "y1")], np.float32)[which]
    along = np.where(which < 2, np.minimum(np.abs(py - ROOM["y0"]), np.abs(py - ROOM["y1"])),
                     np.minimum(np.abs(px - ROOM["x0"]), np.abs(px - ROOM["x1"])))
    z = np.clip(pz, 0, None)
    light = shade * (1 - 0.22 * np.exp(-z / 0.35)) * (1 - 0.10 * np.exp(-along / 0.5))
    light *= 0.94 + 0.06 * np.clip(z / ROOM["ceiling"], 0, 1)
    return base[None] * light[:, None]


def render_showroom(spec: dict, distance_m: float, azimuth_deg: float, yaw_deg: float, pitch_deg: float = 0.0,
                    size: tuple[int, int] = DRAW_SIZE) -> np.ndarray:
    """The room from one camera, BGR uint8 at `size`; the same input always gives the same image. Each
    surface is shaded on its own pixels only, to keep the peak memory down."""
    w, h = size
    cam, d, t, surface, which = _trace(distance_m, azimuth_deg, yaw_deg, pitch_deg, size)
    px, py = cam[0] + t * d[..., 0], cam[1] + t * d[..., 1]
    wall_base = _bgr(spec["wall"])
    img = np.zeros((h, w, 3), np.float32)

    walls = surface == WALL
    pz_w = cam[2] + t[walls] * d[..., 2][walls]
    img[walls] = _wall_colour(wall_base, which[walls], px[walls], py[walls], pz_w)
    img[surface == CEILING] = _bgr(spec["ceiling"]) * 0.985
    del t, which, pz_w

    # Floor: tiles along the car, 6 mm joints smoothed over the pixel footprint (neighbour differences).
    floors = surface == FLOOR
    fu, fv = px / ROOM["tile"], py / ROOM["tile"]
    half = ROOM["joint"] / ROOM["tile"] / 2
    gu = (np.abs(np.gradient(fu, axis=1)) + np.abs(np.gradient(fu, axis=0)))[floors]
    gv = (np.abs(np.gradient(fv, axis=1)) + np.abs(np.gradient(fv, axis=0)))[floors]
    fu, fv = fu[floors], fv[floors]
    line = np.maximum(np.clip(1 - (np.abs(fu - np.round(fu)) - half) / np.maximum(gu, 1e-6), 0, 1),
                      np.clip(1 - (np.abs(fv - np.round(fv)) - half) / np.maximum(gv, 1e-6), 0, 1))
    line *= np.clip(1.5 - np.maximum(gu, gv) * 6, 0, 1)  # fade joints out where a tile shrinks to a few pixels
    rng = np.random.default_rng(7)
    tone = rng.normal(0, 0.025, (64, 64)).astype(np.float32)
    tile = tone[np.floor(fu).astype(np.int64) % 64, np.floor(fv).astype(np.int64) % 64]
    colour = _bgr(spec["floor"])[None] * (1 + tile[:, None])
    colour += (_bgr(spec["grout"])[None] - colour) * line[:, None]
    del gu, gv, fu, fv, line, tile

    # Satin gloss: the wall the mirrored ray meets, more at grazing angles (Fresnel), blurred.
    fx, fy = px[floors], py[floors]
    dx, dy, dz = d[..., 0][floors], d[..., 1][floors], d[..., 2][floors]
    del d, px, py
    fresnel = 0.04 + 0.96 * (1 - np.clip(-dz / np.sqrt(dx * dx + dy * dy + dz * dz), 0, 1)) ** 5
    t2, which2 = _wall_hit(fx, fy, dx, dy)
    h_r = -dz * t2
    mirror = np.zeros((h, w, 3), np.float32)
    mirror[floors] = np.where((h_r > ROOM["ceiling"])[:, None], _bgr(spec["ceiling"])[None],
                              _wall_colour(wall_base, which2, fx + t2 * dx, fy + t2 * dy, h_r))
    del t2, which2, h_r, dx, dy, dz
    mirror = cv2.GaussianBlur(mirror, (0, 0), 9 * w / 2560)[floors]
    gloss = (float(spec["gloss"]) * fresnel)[:, None]
    d_wall = np.minimum(np.minimum(np.abs(fx - ROOM["x0"]), np.abs(fx - ROOM["x1"])),
                        np.minimum(np.abs(fy - ROOM["y0"]), np.abs(fy - ROOM["y1"])))
    img[floors] = (colour * (1 - gloss) + mirror * gloss) * (1 - 0.35 * np.exp(-d_wall / 0.35))[:, None]
    del colour, mirror, gloss, d_wall, fx, fy

    u = (np.arange(w, dtype=np.float32) + 0.5 - w / 2) / (w / 2)
    v = (np.arange(h, dtype=np.float32) + 0.5 - h / 2) / (h / 2)
    img *= (1 - 0.10 * (0.5 * u[None, :] ** 2 + 0.5 * v[:, None] ** 2))[..., None]
    img = img * 255 + rng.normal(0, 1.1, img.shape).astype(np.float32)
    return np.clip(img, 0, 255).astype(np.uint8)


@lru_cache(maxsize=64)
def _drawn(spec_json: str, body_type: str, slot: str, pitch_deg: int) -> np.ndarray:
    camera = template_camera(body_type, slot)
    if camera is None:
        raise ValueError(f"no template camera for {slot}")
    distance, yaw = camera
    img = render_showroom(json.loads(spec_json), distance, SLOT_AZIMUTH[slot], yaw, float(pitch_deg))
    img.setflags(write=False)  # shared by every later call
    return img


def showroom_background(spec: dict, body_type: str, slot: str, pitch_deg: float = 0.0) -> np.ndarray:
    """The 2560×1920 showroom for one exterior photo; pitch in whole degrees, within ±20°."""
    pitch = int(round(float(np.clip(pitch_deg, -MAX_PITCH_DEG, MAX_PITCH_DEG))))
    small = _drawn(json.dumps(spec, sort_keys=True), body_type, slot, pitch)
    return cv2.resize(small, OUT_SIZE, interpolation=cv2.INTER_LINEAR)


def pitch_shift(box_bottom: float, pitch_deg: float, out_size: tuple[int, int] = OUT_SIZE) -> float:
    """How far (px, negative is up) the floor point under the template box's bottom edge moves when the
    camera looks down by `pitch_deg`: the car moves with it and keeps its size."""
    if pitch_deg == 0:
        return 0.0
    w, h = out_size
    f = _focal(w)
    below = box_bottom * h - h / 2
    return float(f * np.tan(np.arctan(below / f) - np.radians(pitch_deg)) - below)
