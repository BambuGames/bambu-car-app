import json
from pathlib import Path

import pytest

from worker.templates import template_box

ROWS = json.loads((Path(__file__).parents[1] / "worker/templates.json").read_text())


def test_template_box_is_the_normal_mode_box():
    row = next(r for r in ROWS if (r["bodyType"], r["slot"], r["mode"]) == ("kombi", "left", "normal"))
    assert template_box("kombi", "left") == tuple(row["box"])


def test_template_box_for_other_is_the_mean():
    boxes = [r["box"] for r in ROWS if r["slot"] == "left" and r["mode"] == "normal"]
    assert len(boxes) == 4
    mean = tuple(sum(b[i] for b in boxes) / 4 for i in range(4))
    assert template_box("other", "left") == pytest.approx(mean)


def test_template_box_for_a_detail_is_none():
    assert template_box("sedan", "detail_wheel") is None
    assert template_box("sedan", "interior_cockpit") is None
