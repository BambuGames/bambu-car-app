import cv2
import numpy as np

from worker.backgrounds import render_background
from worker.compose import compose, contact_shadow, encode_jpeg

WHITE = {"kind": "studio", "wall": "#FFFFFF", "floor": "#F2F2F2"}
DARK = {"kind": "studio", "wall": "#2B2D31", "floor": "#1E1F22"}
GREY = {"kind": "studio", "wall": "#E9EAEC", "floor": "#DCDDE0"}


def test_studio_background_has_wall_floor_and_horizon():
    bg = render_background(DARK)
    assert bg.shape == (1920, 2560, 3)
    assert np.allclose(bg[0, 0], (0x31, 0x2D, 0x2B), atol=2)  # BGR of the wall
    assert np.allclose(bg[-1, 0], (0x22, 0x1F, 0x1E), atol=2)  # floor
    assert np.allclose(bg[900, 100], bg[0, 100], atol=2)  # still wall above the horizon
    assert np.abs(bg[1010, 100].astype(int) - bg[0, 100].astype(int)).max() >= 8  # floor below it


def test_the_studio_has_no_visible_seam():
    # The three platform studios (processing migration): no row may step by more than 2 levels, or the
    # horizon shows as a line.
    for spec in (WHITE, GREY, DARK):
        column = render_background(spec)[:, 0].astype(int)
        assert np.abs(np.diff(column, axis=0)).max() <= 2, spec


def test_an_image_background_is_cropped_to_four_by_three():
    wide = np.zeros((100, 300, 3), np.uint8)
    wide[:, 150:] = 255
    bg = render_background({"kind": "image", "path": "x.jpg"}, (400, 300), lambda path: wide)
    assert bg.shape == (300, 400, 3)


def car_alpha():
    alpha = np.zeros((1920, 2560), np.uint8)
    alpha[900:1440, 256:2304] = 255
    return alpha


def test_shadow_only_below_the_car():
    shadow = contact_shadow(car_alpha())
    car_height = 1440 - 900
    assert shadow[: 1440 - int(0.03 * car_height) - 1].max() == 0  # nothing well above the bottom of the car
    assert shadow[1445, 1280] > 0.2  # dark just below it
    assert shadow.max() <= 0.45 + 1e-6


def test_compose_returns_a_2560_by_1920_jpeg():
    bg = render_background(WHITE)
    car = np.full((1920, 2560, 3), 40, np.uint8)
    alpha = car_alpha()
    out = compose(bg, car, alpha, contact_shadow(alpha))
    assert out[1200, 1280].tolist() == [40, 40, 40]  # the car
    assert out[1446, 1280].max() < bg[1446, 1280].max()  # shadow under it
    decoded = cv2.imdecode(np.frombuffer(encode_jpeg(out), np.uint8), cv2.IMREAD_COLOR)
    assert decoded.shape == (1920, 2560, 3)
