"""Generate capture guide templates: a silhouette (SVG) and a target box (JSON) per body type, slot and lens mode.

Car coordinates: +x is the car's front, +y its left, +z up; the origin is the car's center on the ground.
The photographer walks around the car at one radius per lens mode and keeps the car centered in the frame.
Usage: python tools/templates/templates.py sedan
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import trimesh

# Walking order; value is the camera angle measured from the car's front towards its left (degrees).
SLOTS = {"front_left_45": 45, "front": 0, "front_right_45": 315, "right": 270,
         "rear_right_45": 225, "rear": 180, "rear_left_45": 135, "left": 90}
MODES = {"normal": 69.0, "wide": 106.0}  # horizontal field of view (degrees)
FILL = 0.80  # side view: car width / frame width; sets the walking radius
MARGIN = 0.05  # every silhouette keeps this much of the frame free on each side
IMAGE_SIZE = (1600, 1200)
CAMERA_HEIGHT_M = 1.0

W, H = IMAGE_SIZE
HERE = Path(__file__).parent


def _axis(spec: str) -> np.ndarray:
    v = np.zeros(3)
    v["xyz".index(spec[1])] = 1.0 if spec[0] == "+" else -1.0
    return v


def load_car(path: str, forward: str, up: str, length_m: float) -> tuple[np.ndarray, np.ndarray]:
    mesh = trimesh.load_mesh(path)
    f, u = _axis(forward), _axis(up)
    rot = np.stack([f, np.cross(u, f), u])  # rows: car x (front), y (left), z (up) in model axes
    v = np.asarray(mesh.vertices) @ rot.T
    lo, hi = v.min(axis=0), v.max(axis=0)
    v = (v - [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]]) * (length_m / (hi[0] - lo[0]))
    return v, np.asarray(mesh.faces)


def _to_camera(points, azimuth_deg, distance_m, yaw_deg):
    t, y = np.radians(azimuth_deg), np.radians(yaw_deg)
    camera = np.array([distance_m * np.cos(t), distance_m * np.sin(t), CAMERA_HEIGHT_M])
    forward = np.array([-np.cos(t), -np.sin(t), 0.0])  # level, towards the car's center
    right = np.array([-np.sin(t), np.cos(t), 0.0])
    basis = np.array([np.cos(y) * right - np.sin(y) * forward,   # right, turned by yaw
                      [0.0, 0.0, -1.0],                          # down
                      np.cos(y) * forward + np.sin(y) * right])  # forward, turned by yaw
    return (np.asarray(points, dtype=float) - camera) @ basis.T


def project(points: np.ndarray, azimuth_deg: float, distance_m: float, hfov_deg: float,
            yaw_deg: float = 0.0) -> np.ndarray:
    c = _to_camera(points, azimuth_deg, distance_m, yaw_deg)
    fx = (W / 2) / np.tan(np.radians(hfov_deg) / 2)
    return np.column_stack([W / 2 + fx * c[:, 0] / c[:, 2], H / 2 + fx * c[:, 1] / c[:, 2]])


def center_yaw(vertices: np.ndarray, azimuth_deg: float, distance_m: float) -> float:
    """Yaw (degrees, positive turns right) that centers the car horizontally in the frame."""
    c = _to_camera(vertices, azimuth_deg, distance_m, 0.0)
    angles = np.degrees(np.arctan2(c[:, 0], c[:, 2]))
    return float(angles.min() + angles.max()) / 2


def solve_distance(vertices: np.ndarray, azimuth_deg: float, hfov_deg: float, fill: float) -> float:
    lo = float(np.hypot(*np.abs(vertices[:, :2]).max(axis=0))) + 0.3
    hi = 40.0
    for _ in range(40):
        mid = (lo + hi) / 2
        u = project(vertices, azimuth_deg, mid, hfov_deg)[:, 0]
        if u.max() - u.min() > fill * W:
            lo = mid  # car too wide: step back
        else:
            hi = mid
    return (lo + hi) / 2


def _fits(vertices, hfov_deg, distance_m):
    for azimuth in SLOTS.values():
        uv = project(vertices, azimuth, distance_m, hfov_deg, center_yaw(vertices, azimuth, distance_m))
        lo, hi = uv.min(axis=0), uv.max(axis=0)
        if lo[0] < MARGIN * W or hi[0] > (1 - MARGIN) * W or lo[1] < MARGIN * H or hi[1] > (1 - MARGIN) * H:
            return False
    return True


def mode_distance(vertices: np.ndarray, hfov_deg: float) -> float:
    """Walking radius for one lens mode: the side view fills FILL of the frame width,
    unless another slot would then break the margin; then step back until every slot fits."""
    lo = solve_distance(vertices, 90, hfov_deg, FILL)
    if _fits(vertices, hfov_deg, lo):
        return lo
    hi = 40.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if _fits(vertices, hfov_deg, mid):
            hi = mid
        else:
            lo = mid
    return hi


def silhouette(vertices: np.ndarray, faces: np.ndarray, azimuth_deg: float, distance_m: float,
               hfov_deg: float, yaw_deg: float = 0.0) -> np.ndarray:
    uv = np.round(project(vertices, azimuth_deg, distance_m, hfov_deg, yaw_deg)).astype(np.int32)
    mask = np.zeros((H, W), np.uint8)
    # One call per triangle: a single fillPoly over all triangles uses the even-odd rule and
    # would cut holes wherever front and back faces overlap.
    for tri in uv[faces]:
        cv2.fillConvexPoly(mask, tri, 255)
    return mask


def to_svg_path(mask: np.ndarray) -> str:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    points = cv2.approxPolyDP(max(contours, key=cv2.contourArea), 1.0, True).reshape(-1, 2)
    return "M " + " L ".join(f"{x} {y}" for x, y in points) + " Z"


def _template(vertices, faces, body_type, slot, mode, distance=None):
    azimuth, hfov = SLOTS[slot], MODES[mode]
    distance = mode_distance(vertices, hfov) if distance is None else distance
    yaw = center_yaw(vertices, azimuth, distance)
    mask = silhouette(vertices, faces, azimuth, distance, hfov, yaw)
    x, y, w, h = cv2.boundingRect(mask)
    meta = {"bodyType": body_type, "slot": slot, "mode": mode, "hfovDeg": hfov,
            "cameraHeightM": CAMERA_HEIGHT_M, "pitchDeg": 0.0, "distanceM": round(distance, 3),
            "box": [round(x / W, 4), round(y / H, 4), round((x + w) / W, 4), round((y + h) / H, 4)],
            "svg": f"{slot}_{mode}.svg"}
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><path d="{to_svg_path(mask)}"/></svg>\n'
    return meta, svg, mask, yaw


def make_template(vertices: np.ndarray, faces: np.ndarray, body_type: str, slot: str,
                  mode: str) -> tuple[dict, str]:
    meta, svg, _, _ = _template(vertices, faces, body_type, slot, mode)
    return meta, svg


def generate(body_type: str, out_dir: str) -> None:
    cfg = json.loads((HERE / "body_types.json").read_text())[body_type]
    vertices, faces = load_car(str(HERE / cfg["file"]), cfg["forward"], cfg["up"], cfg["length_m"])
    out = Path(out_dir) / body_type
    out.mkdir(parents=True, exist_ok=True)
    front = np.array([[vertices[:, 0].max(), 0.0, vertices[:, 2].max() / 2]])
    tiles = []
    for mode, hfov in MODES.items():
        distance = mode_distance(vertices, hfov)
        for slot, azimuth in SLOTS.items():
            meta, svg, mask, yaw = _template(vertices, faces, body_type, slot, mode, distance)
            (out / f"{slot}_{mode}.json").write_text(json.dumps(meta, indent=2) + "\n")
            (out / meta["svg"]).write_text(svg)
            # Overview tile: grey silhouette, red dot on the car's front, label.
            tile = np.full((H, W, 3), 255, np.uint8)
            tile[mask > 0] = (160, 160, 160)
            fu, fv = project(front, azimuth, distance, hfov, yaw)[0]
            cv2.circle(tile, (int(fu), int(fv)), 24, (0, 0, 255), -1)
            tile = cv2.resize(tile, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
            cv2.putText(tile, f"{slot} {mode}", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA)
            tiles.append(tile)
    rows = [np.hstack(tiles[i:i + 4]) for i in range(0, len(tiles), 4)]
    cv2.imwrite(str(out / "overview.png"), np.vstack(rows))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate capture guide templates for one body type.")
    parser.add_argument("body_type")
    generate(parser.parse_args().body_type, str(HERE / "out"))
