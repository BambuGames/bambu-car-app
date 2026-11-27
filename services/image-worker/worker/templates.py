"""Where the car goes in the output: the normal-mode template box of its body type and slot (design 7.2.4).

Wide-mode shots are placed on the normal box too, so a set looks the same whichever lens took it.
templates.json comes from `tools/templates/templates.py export-worker`.
"""
import json
from functools import cache
from pathlib import Path

Box = tuple[float, float, float, float]
BODY_TYPES = ("sedan", "kombi", "suv", "hatchback")
# The camera's angle around the car per slot, from its front towards its left (tools/templates SLOTS).
SLOT_AZIMUTH = {"front_left_45": 45.0, "front": 0.0, "front_right_45": 315.0, "right": 270.0,
                "rear_right_45": 225.0, "rear": 180.0, "rear_left_45": 135.0, "left": 90.0}


@cache
def _boxes() -> dict[tuple[str, str], Box]:
    rows = json.loads((Path(__file__).parent / "templates.json").read_text())
    return {(r["bodyType"], r["slot"]): tuple(r["box"]) for r in rows if r["mode"] == "normal"}


def template_box(body_type: str, slot: str) -> Box | None:
    """None for detail and interior slots; for 'other' the mean of the four body types' boxes."""
    boxes = _boxes()
    if body_type in BODY_TYPES:
        return boxes.get((body_type, slot))
    known = [boxes[(b, slot)] for b in BODY_TYPES if (b, slot) in boxes]
    if not known:
        return None
    return tuple(sum(b[i] for b in known) / len(known) for i in range(4))


@cache
def _cameras() -> dict[tuple[str, str], tuple[float, float]]:
    rows = json.loads((Path(__file__).parent / "templates.json").read_text())
    return {(r["bodyType"], r["slot"]): (r["distanceM"], r["yawDeg"]) for r in rows if r["mode"] == "normal"}


def template_camera(body_type: str, slot: str) -> tuple[float, float] | None:
    """(distance in m, centering yaw in degrees) of the normal-mode template camera, from which the showroom
    is drawn; None for detail and interior slots; for 'other' the mean of the four body types."""
    cameras = _cameras()
    if body_type in BODY_TYPES:
        return cameras.get((body_type, slot))
    known = [cameras[(b, slot)] for b in BODY_TYPES if (b, slot) in cameras]
    if not known:
        return None
    return tuple(sum(c[i] for c in known) / len(known) for i in range(2))
