"""The exported detector on real M0 photos. Needs models/plate_rtdetrv2.onnx (scripts/export_plate_onnx.py) and
spikes/data (git-ignored): run with `pytest -m model`."""
import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from worker.plate import PlateDetector

ROOT = Path(__file__).resolve().parents[3]
WORKER = Path(__file__).resolve().parents[1]
PHOTOS = ["01-vw-crosspolo-night-front.jpg", "02-audi-rs4-avant-show-front.jpg", "03-volvo-c70-meet-front.jpg"]


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)


@pytest.mark.model
def test_detector_finds_known_plates():
    detector = PlateDetector(str(WORKER / "models/plate_rtdetrv2.onnx"))
    truth = json.loads((ROOT / "spikes/data/plates_gt.json").read_text())
    for name in PHOTOS:
        image = cv2.imread(str(ROOT / "spikes/data/photos" / name))
        corners = np.array(truth[name])
        gt = (corners[:, 0].min(), corners[:, 1].min(), corners[:, 0].max(), corners[:, 1].max())
        found = detector.detect(image)
        assert found, name
        assert max(iou(box, gt) for _, box in found) >= 0.5, name
