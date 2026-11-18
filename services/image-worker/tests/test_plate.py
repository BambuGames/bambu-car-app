import math

import cv2
import numpy as np

from worker.plate import cover, cover_box, pick_target, refine_corners, restore_covered, warp_banner


def drawn_plate(angle_deg=6.0):
    """A grey scene with a tilted German-looking plate: white field, dark characters, blue EU strip on the left."""
    image = np.full((400, 600, 3), 95, np.uint8)
    w, h = 300, 64  # 520:110 ≈ 4.7
    c, a = np.array([300.0, 210.0]), math.radians(angle_deg)
    rot = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    to_scene = lambda u, v: c + rot @ np.array([u - w / 2, v - h / 2])  # noqa: E731
    corners = np.float32([to_scene(0, 0), to_scene(w, 0), to_scene(w, h), to_scene(0, h)])
    plate = np.full((h, w, 3), 235, np.uint8)
    plate[:, : int(0.11 * w)] = (170, 60, 20)  # BGR blue
    for x in range(int(0.18 * w), int(0.95 * w), 40):
        plate[12:h - 12, x:x + 18] = 25
    m = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), corners)
    warped = cv2.warpPerspective(plate, m, (600, 400))
    inside = cv2.warpPerspective(np.full((h, w), 255, np.uint8), m, (600, 400)) > 0
    image[inside] = warped[inside]
    return image, corners


def test_refine_finds_a_drawn_plate():
    image, truth = drawn_plate()
    xs, ys = truth[:, 0], truth[:, 1]
    found = refine_corners(image, (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
    width = np.linalg.norm(truth[1] - truth[0])
    assert np.mean(np.linalg.norm(found - truth, axis=1)) / width < 0.03  # the blue strip included


def test_refine_falls_back_to_the_box():
    image = np.full((400, 600, 3), 95, np.uint8)
    found = refine_corners(image, (100, 150, 400, 210))
    assert np.allclose(found, [[100, 150], [400, 150], [400, 210], [100, 210]])


def test_cover_makes_the_plate_unreadable():
    image, truth = drawn_plate()
    noise = np.random.default_rng(1).integers(0, 255, image.shape, np.uint8)
    image[:60] = noise[:60]  # texture well outside the plate
    box = (int(truth[:, 0].min()), int(truth[:, 1].min()), int(truth[:, 0].max()), int(truth[:, 1].max()))
    out = cover(image, [box])
    x0, y0, x1, y1 = box
    assert out[y0:y1, x0:x1].std() < 0.1 * image[y0:y1, x0:x1].std()
    assert np.array_equal(out[:60], image[:60])


def test_pick_target_uses_the_car_mask():
    alpha = np.zeros((400, 600), np.uint8)
    alpha[150:300, 50:300] = 255  # the target car
    on_car, elsewhere = (100, 250, 180, 270), (400, 250, 480, 270)
    assert pick_target([(0.95, elsewhere), (0.6, on_car)], alpha) == on_car
    assert pick_target([(0.95, elsewhere)], alpha) is None


def test_banner_lands_on_the_corners():
    canvas = np.zeros((400, 600, 3), np.uint8)
    banner = np.zeros((40, 200, 4), np.uint8)
    banner[..., 2], banner[..., 3] = 255, 255  # opaque red
    corners = np.float32([[200, 180], [400, 190], [398, 230], [198, 220]])
    out = warp_banner(canvas, banner, corners)
    assert out[205, 300].tolist() == [0, 0, 255]
    assert out[180 - 6, 300].tolist() == [0, 0, 0]


def test_restore_fills_a_plate_hole_inside_the_car():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 40:260] = 255
    box = (120, 120, 180, 135)
    x0, y0, x1, y1 = cover_box(box, 300, 200)
    alpha[y0:y1, x0:x1] = 0  # Photoroom took the flat cover for background
    out = restore_covered(alpha, [box])
    assert out[127, 150] == 255 and out[10, 10] == 0


def test_restore_fills_a_plate_hole_at_the_cars_edge():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 100:260] = 255
    box = (98, 120, 158, 135)  # rear plate seen at an angle, at the car's left outline
    x0, y0, x1, y1 = cover_box(box, 300, 200)
    alpha[y0:y1, x0:x1] = 0
    assert restore_covered(alpha, [box])[127, 130] == 255


def test_restore_leaves_a_plate_off_the_car():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 150:290] = 255
    out = restore_covered(alpha, [(20, 120, 80, 135)])  # a plate on another car, on the background
    assert out[127, 50] == 0


def test_banner_stays_on_the_car():
    canvas = np.zeros((100, 100, 3), np.uint8)
    banner = np.zeros((10, 40, 4), np.uint8)
    banner[..., 2], banner[..., 3] = 255, 255
    clip = np.zeros((100, 100), np.uint8)
    clip[:, :50] = 255  # the car ends at x = 50
    out = warp_banner(canvas, banner, np.float32([[10, 40], [90, 40], [90, 60], [10, 60]]), clip)
    assert out[50, 30, 2] > 200 and out[50, 70].sum() == 0


def test_banner_is_not_clipped_without_a_mask():
    canvas = np.zeros((100, 100, 3), np.uint8)
    banner = np.zeros((10, 40, 4), np.uint8)
    banner[..., 2], banner[..., 3] = 255, 255
    out = warp_banner(canvas, banner, np.float32([[10, 40], [90, 40], [90, 60], [10, 60]]))
    assert out[50, 70, 2] > 200


def test_restore_never_fills_past_the_cars_outline():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 100:260] = 255
    box = (70, 120, 130, 135)  # half the plate past the car's left outline
    x0, y0, x1, y1 = cover_box(box, 300, 200)
    alpha[y0:y1, x0:x1] = 0
    out = restore_covered(alpha, [box])
    assert out[127, 120] == 255  # the notch in the car is closed
    assert not out[:, :100].any()  # nothing outside the car
