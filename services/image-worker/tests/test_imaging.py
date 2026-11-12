import io
import math

import cv2
import numpy as np
from PIL import Image

from worker.imaging import apply_edits, bbox, keep_target, load_upright, placement, straighten


def blob(alpha, x0, y0, x1, y1):
    alpha[y0:y1, x0:x1] = 255
    return alpha


def test_load_upright_applies_exif_orientation():
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90° clockwise to display
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "red").save(buf, "JPEG", exif=exif)
    assert load_upright(buf.getvalue()).shape == (40, 30, 3)


def test_straighten_levels_a_line_rising_to_the_right():
    img = np.zeros((300, 400, 3), np.uint8)
    rise = math.tan(math.radians(5))
    cv2.line(img, (50, int(200 + 150 * rise)), (350, int(200 - 150 * rise)), (255, 255, 255), 3)
    out, _, _ = straighten(img, None, 5)
    ys, xs = np.nonzero(out[:, :, 0] > 128)
    slope = np.polyfit(xs, ys, 1)[0]
    assert abs(math.degrees(math.atan(slope))) < 0.5


def test_straighten_ignores_an_out_of_range_roll():
    img = np.random.default_rng(0).integers(0, 255, (30, 40, 3), np.uint8)
    out, alpha, m = straighten(img, np.zeros((30, 40), np.uint8), 90)
    assert np.array_equal(out, img) and alpha.shape == (30, 40)
    assert np.allclose(m, [[1, 0, 0], [0, 1, 0]])


def test_keep_target_drops_a_separate_car():
    alpha = blob(blob(np.zeros((100, 200), np.uint8), 10, 40, 90, 80), 120, 40, 190, 80)
    kept = keep_target(alpha, (0.05, 0.4, 0.45, 0.8))
    assert kept[60, 50] == 255 and kept[60, 150] == 0


def test_keep_target_keeps_parts_outside_the_box():
    alpha = blob(blob(np.zeros((100, 200), np.uint8), 40, 50, 160, 90), 120, 10, 123, 50)  # antenna on the roof
    kept = keep_target(alpha, (0.25, 0.55, 0.75, 0.9))  # box misses the antenna, like a tight detection
    assert kept[20, 121] == 255


def test_keep_target_without_box_keeps_the_central_blob():
    alpha = blob(blob(np.zeros((100, 200), np.uint8), 70, 30, 130, 70), 0, 0, 60, 100)  # larger blob at the edge
    kept = keep_target(alpha, None)
    assert kept[50, 100] == 255 and kept[50, 30] == 0


def test_erase_edit_clears_the_stroke():
    alpha = blob(np.zeros((100, 200), np.uint8), 0, 0, 200, 100)
    out = apply_edits(alpha, [{"type": "erase", "points": [[0.1, 0.5], [0.9, 0.5]], "radius": 0.02}])
    assert out[50, 100] == 0 and out[10, 100] == 255


def test_remove_edit_drops_a_piece_but_never_the_car():
    alpha = blob(blob(np.zeros((100, 200), np.uint8), 20, 20, 140, 90), 160, 30, 190, 60)
    out = apply_edits(alpha, [{"type": "remove", "point": [175 / 200, 45 / 100]}, {"type": "remove", "point": [0.4, 0.5]}])
    assert out[45, 175] == 0 and out[50, 80] == 255


def test_placement_puts_the_car_on_the_template_box():
    m = placement((100, 50, 300, 150), (0.1, 0.4, 0.9, 0.75))
    left, bottom_left = m @ [100, 150, 1], m @ [100, 150, 1]
    right = m @ [300, 150, 1]
    assert abs(left[0] - 256) <= 1 and abs(right[0] - 2304) <= 1
    assert abs(bottom_left[1] - 1440) <= 1


def test_bbox_of_an_empty_mask_is_none():
    assert bbox(np.zeros((10, 10), np.uint8)) is None
    assert bbox(blob(np.zeros((10, 20), np.uint8), 2, 3, 8, 9)) == (2, 3, 8, 9)
