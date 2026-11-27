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


def wheels(*centres, r=110, body=(500, 1150, 2100, 1330)):
    """A car body box with round tyres below it: centres are (x, y_bottom_of_tyre)."""
    a = np.zeros((1920, 2560), np.uint8)
    x0, y0, x1, y1 = body
    a[y0:y1, x0:x1] = 255
    for cx, bottom in centres:
        cv2.circle(a, (cx, bottom - r), r, 255, -1)
    return a


def test_every_wheel_on_the_ground_line_gets_a_dark_contact():
    a = wheels((700, 1440), (1900, 1390))  # 45° view: the far wheel stands higher
    s = contact_shadow(a)
    assert s[1443, 700] > 0.5 and s[1393, 1900] > 0.5


def test_a_far_wheel_at_the_end_of_the_outline_gets_a_contact_too():
    a = wheels((700, 1440), (1500, 1430), (2080, 1380))
    assert contact_shadow(a)[1383, 2080] > 0.5


def test_the_floor_under_the_body_is_darker_than_the_open_floor():
    a = wheels((700, 1440), (1900, 1390))
    s = contact_shadow(a)
    assert 0.1 < s[1350, 1300] < s[1443, 700]  # under the sill, between the tyres
    assert s[1700, 1300] < 0.05  # far below the car


def test_no_shadow_above_the_outline_or_beside_the_car():
    a = wheels((700, 1440), (1900, 1390))
    s = contact_shadow(a)
    assert s[:1100].max() == 0  # above the body
    assert s[:, :300].max() < 0.02 and s[:, 2400:].max() < 0.02
    assert s.max() <= 0.9 + 1e-6


def test_shadow_shows_on_a_dark_floor():
    bg = render_background(DARK)
    a = wheels((700, 1440), (1900, 1390))
    car = np.full((1920, 2560, 3), 200, np.uint8)
    out = compose(bg, car, a, contact_shadow(a))
    assert int(bg[1446, 700].max()) - int(out[1446, 700].max()) >= 10


def test_compose_returns_a_2560_by_1920_jpeg():
    bg = render_background(WHITE)
    car = np.full((1920, 2560, 3), 40, np.uint8)
    alpha = car_alpha()
    out = compose(bg, car, alpha, contact_shadow(alpha))
    assert out[1200, 1280].tolist() == [40, 40, 40]  # the car
    assert out[1446, 1280].max() < bg[1446, 1280].max()  # shadow under it
    decoded = cv2.imdecode(np.frombuffer(encode_jpeg(out), np.uint8), cv2.IMREAD_COLOR)
    assert decoded.shape == (1920, 2560, 3)
