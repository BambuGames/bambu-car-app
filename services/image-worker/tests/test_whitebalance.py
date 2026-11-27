import numpy as np

from worker.whitebalance import apply_gains, estimate_gains


def scene(bg_bgr, car_bgr=(128, 128, 128)):
    img = np.zeros((600, 800, 3), np.uint8)
    img[:] = bg_bgr
    alpha = np.zeros((600, 800), np.uint8)
    alpha[200:450, 200:600] = 255
    img[alpha > 0] = car_bgr
    return img, alpha


def test_a_yellow_garage_is_pulled_toward_neutral():
    img, alpha = scene((80, 118, 157))  # warm grey walls (BGR)
    g = estimate_gains(img, alpha)
    assert g is not None and g[0] > 1.05 and g[2] < 0.97
    out = apply_gains(img, g)[50, 50].astype(int)
    assert out.max() - out.min() < 0.5 * (157 - 80)


def test_a_neutral_scene_is_left_alone():
    assert estimate_gains(*scene((120, 121, 119))) is None


def test_a_saturated_wall_does_not_tint_the_car():
    img, alpha = scene((40, 40, 200), car_bgr=(235, 235, 235))  # red brick behind a white car
    img[480:] = (110, 110, 110)  # a grey pavement strip
    assert estimate_gains(img, alpha) is None


def test_too_little_neutral_surround_gives_no_gains():
    img, alpha = scene((30, 200, 30))  # all saturated green
    assert estimate_gains(img, alpha) is None


def test_no_gains_leave_the_image_unchanged():
    img, _ = scene((80, 118, 157))
    assert np.array_equal(apply_gains(img, None), img)


def test_grass_around_the_car_does_not_count_as_a_cast():
    img, alpha = scene((90, 160, 130))  # sunlit grass (BGR): green, saturation below the neutral limit
    img[480:] = (120, 121, 119)  # a grey path
    assert estimate_gains(img, alpha) is None


def test_a_beige_wall_in_daylight_does_not_turn_a_white_car_blue():
    img, alpha = scene((150, 190, 220), car_bgr=(235, 235, 235))  # sand-coloured facade (BGR), saturation 0.32
    img[480:] = (110, 110, 110)  # grey pavement
    car = apply_gains(img, estimate_gains(img, alpha))[300, 400].astype(int)
    assert car.max() - car.min() <= 6


def test_white_balance_stays_light_on_a_12_mp_photo():
    # Four analysis threads can reach this at once on a 2 GiB worker.
    import tracemalloc

    img = np.full((3000, 4000, 3), (80, 118, 157), np.uint8)
    alpha = np.zeros((3000, 4000), np.uint8)
    alpha[1000:2200, 1000:3000] = 255
    tracemalloc.start()
    gains = estimate_gains(img, alpha)
    _, estimate_peak = tracemalloc.get_traced_memory()
    tracemalloc.reset_peak()
    apply_gains(img, gains)
    _, apply_peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    assert gains is not None
    assert estimate_peak < 80e6 and apply_peak < 60e6
