import numpy as np

from worker.watermark import apply_watermark

LOGO = np.full((50, 100, 4), 255, np.uint8)  # opaque white, 2:1


def test_watermark_corner_and_opacity():
    canvas = np.zeros((300, 400, 3), np.uint8)
    out = apply_watermark(canvas, LOGO, {"position": "bottom_right", "width": 0.18, "opacity": 0.5})
    # logo 72 × 36 px, 3 % (12 px) from the right and bottom edges
    assert abs(int(out[270, 352, 0]) - 128) <= 2
    assert out[100, 100].tolist() == [0, 0, 0] and out[270, 300].tolist() == [0, 0, 0]


def test_band_holds_the_logo():
    canvas = np.zeros((300, 400, 3), np.uint8)
    out = apply_watermark(canvas, LOGO, {"position": "bottom_right", "width": 0.18, "opacity": 1,
                                         "band": {"edge": "bottom", "color": "#336699", "height": 0.1}})
    assert out[295, 5].tolist() == [0x99, 0x66, 0x33]  # band across the whole width (BGR)
    band = out[270:300]
    assert (band == 255).all(axis=2).any()  # the logo is in the band
    assert out[:270].max() == 0  # and nowhere above it


def test_no_logo_no_band_leaves_the_image():
    canvas = np.random.default_rng(2).integers(0, 255, (300, 400, 3), np.uint8)
    out = apply_watermark(canvas, None, {})
    assert np.array_equal(out, canvas) and out is not canvas
