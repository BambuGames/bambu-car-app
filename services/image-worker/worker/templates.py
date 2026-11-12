"""Where the car goes in the output: the normal-mode template box of its body type and slot (design 7.2.4).

Wide-mode shots are placed on the normal box too, so a set looks the same whichever lens took it.
templates.json comes from `tools/templates/templates.py export-worker`.
"""
import json
from functools import cache
from pathlib import Path

Box = tuple[float, float, float, float]
BODY_TYPES = ("sedan", "kombi", "suv", "hatchback")


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
