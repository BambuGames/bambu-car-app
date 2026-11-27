import numpy as np

from worker.showroom import pitch_shift, render_showroom, showroom_background, trace

WEISS = {"kind": "showroom", "wall": "#F0F1F1", "ceiling": "#F6F7F7", "floor": "#44474B", "grout": "#2B2D30", "gloss": 0.55}
ANTHRAZIT = {"kind": "showroom", "wall": "#474B50", "ceiling": "#55595E", "floor": "#2C2F32", "grout": "#1E2022", "gloss": 0.45}
SIZE = (1280, 960)


def test_level_camera_sees_no_floor_above_the_middle_row():
    s = trace(4.735, 45, 0.0, 0.0, SIZE)["surface"]
    assert not (s[: SIZE[1] // 2] == 0).any() and (s[-1] == 0).all()


def test_looking_down_raises_the_floor_above_the_middle_row():
    s = trace(4.735, 45, 0.0, 10.0, SIZE)["surface"]
    assert (s[SIZE[1] // 2 - 40] == 0).any()


def test_front_view_looks_along_the_car_axis():
    t = trace(4.587, 0, 0.0, 0.0, SIZE)
    centre = SIZE[0] // 2
    floor_rows = t["surface"][:, centre] == 0
    assert np.abs(t["y"][floor_rows, centre]).max() < 0.01  # the centre column runs along y = 0


def test_side_view_looks_across_the_car():
    t = trace(4.587, 90, 0.0, 0.0, SIZE)
    centre = SIZE[0] // 2
    floor_rows = t["surface"][:, centre] == 0
    assert np.abs(t["x"][floor_rows, centre]).max() < 0.01


def test_render_is_deterministic_and_spec_dependent():
    a = render_showroom(WEISS, 4.735, 45, 0.0)
    assert a.shape == (960, 1280, 3) and np.array_equal(a, render_showroom(WEISS, 4.735, 45, 0.0))
    assert np.abs(a.astype(int) - render_showroom(ANTHRAZIT, 4.735, 45, 0.0).astype(int)).mean() > 40


def test_showroom_background_is_full_size_and_keyed_by_spec():
    a = showroom_background(WEISS, "suv", "front")
    assert a.shape == (1920, 2560, 3) and np.array_equal(a, showroom_background(WEISS, "suv", "front"))
    assert not np.array_equal(a, showroom_background(ANTHRAZIT, "suv", "front"))


def test_pitch_shift_moves_the_contact_up_when_looking_down():
    assert pitch_shift(0.82, 0.0) == 0
    assert pitch_shift(0.82, 8.0) < -200
