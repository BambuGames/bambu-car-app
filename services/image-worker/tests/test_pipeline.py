"""The whole worker on synthetic photos: a grey 'car' (and sometimes a neighbour joined to it) on a textured
lot, a fake Photoroom that returns those shapes, and a fake detector that finds a plate on the car."""
import io

import cv2
import numpy as np
import pytest
from PIL import Image

from tests.fakes import FakeDetector, FakePhotoroom, MemoryStore
from worker.backgrounds import render_background
from worker.photoroom import PhotoroomError
from worker.pipeline import run

W, H = 800, 600
CAR = (200, 250, 600, 450)
NEIGHBOUR = (620, 300, 760, 440)
BRIDGE = (600, 400, 620, 410)
PLATE = (370, 400, 430, 415)
STUDIO = {"kind": "studio", "wall": "#FFFFFF", "floor": "#F2F2F2"}


def jpeg(image: np.ndarray) -> bytes:
    return cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 95])[1].tobytes()


def png(rgba: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG")
    return buf.getvalue()


def original(index: int, grey: int = 90, neighbour: bool = False) -> np.ndarray:
    rng = np.random.default_rng(index)
    image = rng.integers(60, 200, (H, W, 3), np.uint8)
    x0, y0, x1, y1 = CAR
    image[y0:y1, x0:x1] = grey
    if neighbour:
        image[NEIGHBOUR[1]:NEIGHBOUR[3], NEIGHBOUR[0]:NEIGHBOUR[2]] = 150
        image[BRIDGE[1]:BRIDGE[3], BRIDGE[0]:BRIDGE[2]] = 150
    px0, py0, px1, py1 = PLATE
    image[py0:py1, px0:px1] = 230
    image[py0 + 3:py1 - 3, px0 + 8:px1 - 8:6] = 20  # characters
    image[:10, :10] = 10 * index  # tells the fake Photoroom which photo it got
    return image


def shape_mask(neighbour: bool = False) -> np.ndarray:
    alpha = np.zeros((H, W), np.uint8)
    for (x0, y0, x1, y1), on in ((CAR, True), (NEIGHBOUR, neighbour), (BRIDGE, neighbour)):
        if on:
            alpha[y0:y1, x0:x1] = 255
    return alpha


def photo_index(sent: bytes) -> int:
    image = cv2.imdecode(np.frombuffer(sent, np.uint8), cv2.IMREAD_COLOR)
    return int(round(image[2:8, 2:8].mean() / 10))


def setup(photos: list[dict], tone: bool = True):
    """photos: dicts with id, slot, index and optional grey, neighbour, edits."""
    banner = np.zeros((20, 100, 4), np.uint8)
    banner[..., 0], banner[..., 3] = 255, 255  # red (RGBA, as the gallery's PNG)
    logo = np.zeros((40, 80, 4), np.uint8)
    logo[..., 3] = 255  # opaque black, visible on the white studio
    store = MemoryStore(
        vehicle_rows={"v1": {"id": "v1", "gallery_id": "g1", "body_type": "sedan", "tone_enabled": tone,
                             "status": "processing", "background": {"spec": STUDIO},
                             "gallery": {"watermark": {"position": "bottom_right"}, "logo_path": "g1/logo.png",
                                         "banner_path": "g1/banner.png"}}},
        files={("branding", "g1/logo.png"): png(logo), ("branding", "g1/banner.png"): png(banner)},
    )
    for p in photos:
        path = f"g1/v1/{p['id']}.jpg"
        store.files[("originals", path)] = jpeg(original(p["index"], p.get("grey", 90), p.get("neighbour", False)))
        x0, y0, x1, y1 = CAR
        store.photo_rows[p["id"]] = {
            "id": p["id"], "vehicle_id": "v1", "gallery_id": "g1", "slot": p["slot"], "original_path": path,
            "captured_at": "2026-11-12T10:00:00+00:00",
            "capture": {"targetBox": [x0 / W, y0 / H, x1 / W, y1 / H], "rollDeg": 0},
            "process_status": "queued", "mask_path": None, "mask_edits": p.get("edits", []), "plate_status": None,
            "plate_corners": None, "tone_stats": None, "output_path": None, "output_wm_path": None, "placement": None,
        }
    masks = {p["index"]: p.get("mask", shape_mask(p.get("neighbour", False))) for p in photos}
    photoroom = FakePhotoroom(lambda sent: masks[photo_index(sent)])
    detector = FakeDetector(lambda image: [(0.9, PLATE)] if all(p.get("plate", True) for p in photos) else [])
    return store, photoroom, detector


def decode(store, path):
    return cv2.imdecode(np.frombuffer(store.files[("processed", path)], np.uint8), cv2.IMREAD_COLOR)


def to_output(row, x, y):
    m = np.array(row["placement"]["m"])
    ox, oy = m @ [x, y, 1]
    return int(round(ox)), int(round(oy))


def go(store, photoroom, detector, ids, clock=lambda: 1000.0):
    return run(store, "v1", ids, photoroom, detector, clock=clock)


def test_a_full_run_writes_both_outputs_and_marks_done():
    store, photoroom, detector = setup([
        {"id": "p1", "slot": "front_left_45", "index": 1},
        {"id": "p2", "slot": "front", "index": 2},
        {"id": "p3", "slot": "detail_wheel", "index": 3},
    ])
    assert go(store, photoroom, detector, ["p1", "p2", "p3"]) == {"done": 3, "failed": 0}
    assert store.vehicle_rows["v1"]["status"] == "ready"
    for pid in ("p1", "p2", "p3"):
        row = store.photo_rows[pid]
        assert row["process_status"] == "done" and row["process_error"] is None
        assert decode(store, row["output_path"]).shape == (1920, 2560, 3)
        assert decode(store, row["output_wm_path"]).shape == (1920, 2560, 3)
        assert row["placement"]["src"] == [W, H] and np.array(row["placement"]["m"]).shape == (2, 3)
    p1 = store.photo_rows["p1"]
    assert ("processed", p1["mask_path"]) in store.files and store.photo_rows["p3"]["mask_path"] is None
    assert p1["plate_status"] == "auto" and len(p1["plate_corners"]) == 4
    plain, marked = decode(store, p1["output_path"]), decode(store, p1["output_wm_path"])
    bx, by = to_output(p1, (PLATE[0] + PLATE[2]) / 2, (PLATE[1] + PLATE[3]) / 2)
    b, g, r = plain[by, bx].astype(int)
    assert r > 180 and g < 80 and b < 80  # the banner sits on the plate
    assert np.abs(plain[1700:1880, 2000:2480].astype(int) - marked[1700:1880, 2000:2480]).max() > 50  # logo


def test_a_rerender_does_not_call_photoroom():
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1}])
    go(store, photoroom, detector, ["p1"], clock=lambda: 1000.0)
    first = store.photo_rows["p1"]["output_path"]
    store.photo_rows["p1"]["process_status"] = "queued"
    go(store, photoroom, detector, ["p1"], clock=lambda: 2000.0)
    assert len(photoroom.sent) == 1
    assert store.photo_rows["p1"]["output_path"] != first
    assert ("processed", first) not in store.files


def test_mask_edits_are_applied():
    erase = [{"type": "erase", "points": [[0.87, 0.55], [0.87, 0.7]], "radius": 0.09}]
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "neighbour": True,
                                         "edits": erase}])
    go(store, photoroom, detector, ["p1"])
    row = store.photo_rows["p1"]
    out = decode(store, row["output_path"])
    x, y = to_output(row, 700, 350)  # the middle of the erased neighbour
    background = render_background(STUDIO)
    assert np.abs(out[y, x].astype(int) - background[y, x]).max() < 12


def test_an_empty_mask_fails_only_that_photo():
    store, photoroom, detector = setup([
        {"id": "p1", "slot": "front_left_45", "index": 1},
        {"id": "p2", "slot": "front", "index": 2, "mask": np.zeros((H, W), np.uint8)},
    ])
    assert go(store, photoroom, detector, ["p1", "p2"]) == {"done": 1, "failed": 1}
    assert store.photo_rows["p1"]["process_status"] == "done"
    assert (store.photo_rows["p2"]["process_status"], store.photo_rows["p2"]["process_error"]) == ("failed", "empty_mask")
    assert store.photo_rows["p2"]["tone_stats"] is None  # an empty mask does not pull the set's tone
    assert store.vehicle_rows["v1"]["status"] == "ready"


def test_a_photoroom_error_is_recorded():
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1,
                                         "mask": PhotoroomError("photoroom_402")}])
    go(store, photoroom, detector, ["p1"])
    assert (store.photo_rows["p1"]["process_status"], store.photo_rows["p1"]["process_error"]) == ("failed", "photoroom_402")


def test_plates_are_covered_before_photoroom():
    store, photoroom, detector = setup([{"id": "p1", "slot": "front", "index": 1}])
    go(store, photoroom, detector, ["p1"])
    sent = cv2.imdecode(np.frombuffer(photoroom.sent[0], np.uint8), cv2.IMREAD_COLOR)
    x0, y0, x1, y1 = PLATE
    assert sent[y0:y1, x0:x1].std() < 0.1 * original(1)[y0:y1, x0:x1].std()


@pytest.mark.parametrize("slot, status", [("left", "none"), ("front", "needs_check"), ("detail_wheel", "none")])
def test_a_missing_plate_is_flagged_only_where_one_should_be(slot, status):
    store, photoroom, detector = setup([{"id": "p1", "slot": slot, "index": 1, "plate": False}])
    go(store, photoroom, detector, ["p1"])
    assert store.photo_rows["p1"]["plate_status"] == status


def test_tone_off_leaves_the_car_colours():
    store, photoroom, detector = setup([
        {"id": "p1", "slot": "front_left_45", "index": 1, "grey": 60},
        {"id": "p2", "slot": "front", "index": 2, "grey": 140},
    ], tone=False)
    go(store, photoroom, detector, ["p1", "p2"])
    for pid, grey in (("p1", 60), ("p2", 140)):
        row = store.photo_rows[pid]
        x, y = to_output(row, 260, 300)  # on the car, away from the plate
        assert np.abs(decode(store, row["output_path"])[y, x].astype(int) - grey).max() <= 6


def test_a_scrap_of_a_car_fails_as_too_small():
    scrap = np.zeros((H, W), np.uint8)
    scrap[300:304, 400:406] = 255
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "mask": scrap}])
    go(store, photoroom, detector, ["p1"])
    assert (store.photo_rows["p1"]["process_status"], store.photo_rows["p1"]["process_error"]) == ("failed", "car_too_small")


def test_a_photo_reshot_during_the_run_is_left_alone():
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1}])

    def reshoot(sent):
        # The app pushes a new original while Photoroom works; the database trigger resets the row.
        store.photo_rows["p1"].update({"captured_at": "2026-11-12T11:00:00+00:00", "process_status": "unprocessed",
                                       "mask_path": None, "plate_status": None, "tone_stats": None})
        return shape_mask()

    photoroom.mask_for = reshoot
    go(store, photoroom, detector, ["p1"])
    row = store.photo_rows["p1"]
    assert (row["process_status"], row["mask_path"], row["output_path"]) == ("unprocessed", None, None)
    assert not any(bucket == "processed" and "out-" in path for bucket, path in store.files)


def test_an_archived_vehicle_stays_archived():
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1}])
    masks = photoroom.mask_for

    def archive(sent):
        store.vehicle_rows["v1"]["status"] = "archived"
        return masks(sent)

    photoroom.mask_for = archive
    go(store, photoroom, detector, ["p1"])
    assert store.vehicle_rows["v1"]["status"] == "archived"


def test_a_stale_mask_fails_instead_of_misplacing():
    store, photoroom, detector = setup([{"id": "p1", "slot": "front_left_45", "index": 1}])
    store.files[("processed", "g1/v1/p1/mask.png")] = cv2.imencode(".png", np.full((300, 400), 255, np.uint8))[1].tobytes()
    store.photo_rows["p1"].update({"mask_path": "g1/v1/p1/mask.png", "plate_status": "none", "tone_stats": {"L": 50, "a": 0, "b": 0}})
    go(store, photoroom, detector, ["p1"])
    assert (store.photo_rows["p1"]["process_status"], store.photo_rows["p1"]["process_error"]) == ("failed", "stale_mask")
