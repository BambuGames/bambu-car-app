import cv2
import numpy as np
import pytest

from worker.tone import apply, correction, mean_correction, measure, set_target


def car(lightness: float, a: float = 0, b: float = 0, size=(60, 80)):
    """A uniform 'car' of the given Lab colour on a full mask."""
    lab = np.zeros((*size, 3), np.uint8)
    lab[..., 0], lab[..., 1], lab[..., 2] = round(lightness * 255 / 100), 128 + a, 128 + b
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), np.full(size, 255, np.uint8)


def test_a_set_moves_toward_its_own_average():
    dark, light = car(40), car(60)
    stats = [measure(*dark), measure(*light)]
    target = set_target(stats)
    corrected = [measure(apply(img, correction(s, target), alpha), alpha) for (img, alpha), s in zip((dark, light), stats)]
    assert corrected[0]["L"] == pytest.approx(45, abs=1)
    assert corrected[1]["L"] == pytest.approx(55, abs=1)


def test_a_black_car_stays_black():
    cars = [car(17), car(18), car(19)]
    stats = [measure(*c) for c in cars]
    target = set_target(stats)
    for (img, alpha), s in zip(cars, stats):
        assert measure(apply(img, correction(s, target), alpha), alpha)["L"] < 25


def test_correction_is_limited():
    assert correction({"L": 20, "a": 0, "b": 0}, {"L": 80, "a": 0, "b": 0})["gain"] == pytest.approx(1.25)
    assert correction({"L": 50, "a": -20, "b": 30}, {"L": 50, "a": 20, "b": -30})["da"] == pytest.approx(6)


def test_detail_gets_the_mean_correction():
    mean = mean_correction([{"gain": 1.1, "da": 2, "db": -2}, {"gain": 0.9, "da": 0, "db": 0}])
    assert mean == pytest.approx({"gain": 1.0, "da": 1, "db": -1})
    assert mean_correction([]) == {"gain": 1.0, "da": 0.0, "db": 0.0}
    assert set_target([]) is None


def test_only_the_car_changes_under_its_mask():
    img, _ = car(40)
    alpha = np.zeros(img.shape[:2], np.uint8)
    alpha[:, :40] = 255
    out = apply(img, {"gain": 1.25, "da": 0, "db": 0}, alpha)
    assert out[30, 60].tolist() == img[30, 60].tolist() and out[30, 10].mean() > img[30, 10].mean()
