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
from worker.plate import cover_box
from worker.showroom import pitch_shift, showroom_background
from worker.templates import template_box

W, H = 800, 600
CAR = (200, 250, 600, 450)
NEIGHBOUR = (620, 300, 760, 440)
BRIDGE = (600, 400, 620, 410)
PLATE = (370, 400, 430, 415)
STUDIO = {"kind": "studio", "wall": "#FFFFFF", "floor": "#F2F2F2"}
SHOWROOM = {"kind": "showroom", "wall": "#F0F1F1", "ceiling": "#F6F7F7", "floor": "#44474B", "grout": "#2B2D30", "gloss": 0.55}


def jpeg(image: np.ndarray) -> bytes:
    return cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 95])[1].tobytes()


def png(rgba: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG")
    return buf.getvalue()


def original(index: int, grey: int = 90, neighbour: bool = False, tint: tuple | None = None) -> np.ndarray:
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
    if tint is not None:  # coloured light over the whole scene, car included (BGR factors)
        image = np.clip(image * np.array(tint, np.float32), 0, 255).astype(np.uint8)
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


def setup(photos: list[dict], tone: bool = True, background: dict = STUDIO, body: str = "sedan"):
    """photos: dicts with id, slot, index and optional grey, neighbour, edits, pitch (signed, > 0 down)."""
    banner = np.zeros((20, 100, 4), np.uint8)
    banner[..., 0], banner[..., 3] = 255, 255  # red (RGBA, as the gallery's PNG)
    logo = np.zeros((40, 80, 4), np.uint8)
    logo[..., 3] = 255  # opaque black, visible on the white studio
    store = MemoryStore(
        vehicle_rows={"v1": {"id": "v1", "gallery_id": "g1", "body_type": body, "tone_enabled": tone,
                             "status": "processing", "background": {"spec": background},
                             "gallery": {"watermark": {"position": "bottom_right"}, "logo_path": "g1/logo.png",
                                         "banner_path": "g1/banner.png"}}},
        files={("branding", "g1/logo.png"): png(logo), ("branding", "g1/banner.png"): png(banner)},
    )
    for p in photos:
        path = f"g1/v1/{p['id']}.jpg"
        store.files[("originals", path)] = jpeg(original(p["index"], p.get("grey", 90), p.get("neighbour", False),
                                                         p.get("tint")))
        x0, y0, x1, y1 = CAR
        store.photo_rows[p["id"]] = {
            "id": p["id"], "vehicle_id": "v1", "gallery_id": "g1", "slot": p["slot"], "original_path": path,
            "captured_at": "2026-11-12T10:00:00+00:00",
            "capture": {"targetBox": [x0 / W, y0 / H, x1 / W, y1 / H], "rollDeg": 0,
                        **({"pitchSignedDeg": p["pitch"]} if "pitch" in p else {})},
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


def test_a_plate_cut_out_of_the_mask_is_put_back():
    mask = shape_mask()
    x0, y0, x1, y1 = cover_box(PLATE, W, H)
    mask[y0:y1, x0:x1] = 0
    store, photoroom, detector = setup([{"id": "p1", "slot": "front", "index": 1, "mask": mask}])
    go(store, photoroom, detector, ["p1"])
    row = store.photo_rows["p1"]
    assert row["plate_status"] == "auto"
    stored = cv2.imdecode(np.frombuffer(store.files[("processed", row["mask_path"])], np.uint8), cv2.IMREAD_GRAYSCALE)
    assert stored[(PLATE[1] + PLATE[3]) // 2, (PLATE[0] + PLATE[2]) // 2] == 255


@pytest.mark.parametrize("slot, status", [("interior_cockpit", "none"), ("detail_engine", "none"), ("detail_taillights", "auto")])
def test_plates_are_searched_only_where_a_plate_can_show(slot, status):
    store, photoroom, detector = setup([{"id": "p1", "slot": slot, "index": 1}])  # the detector finds PLATE
    go(store, photoroom, detector, ["p1"])
    assert store.photo_rows["p1"]["plate_status"] == status


def test_a_showroom_gives_each_slot_its_own_room():
    store, pr, det = setup([{"id": "p1", "slot": "front", "index": 1}, {"id": "p2", "slot": "left", "index": 2}],
                           background=SHOWROOM)
    go(store, pr, det, ["p1", "p2"])
    for pid, slot in (("p1", "front"), ("p2", "left")):
        out = decode(store, store.photo_rows[pid]["output_path"])
        room = showroom_background(SHOWROOM, "sedan", slot)
        assert np.abs(out[40:200, 40:200].astype(int) - room[40:200, 40:200].astype(int)).mean() < 4


def test_a_tilted_photo_moves_the_car_with_the_floor():
    flat, tilted = (setup([{"id": "p1", "slot": "front_left_45", "index": 1, "pitch": p}], background=SHOWROOM)
                    for p in (0.0, 8.0))
    for s in (flat, tilted):
        go(s[0], s[1], s[2], ["p1"])
    dy = tilted[0].photo_rows["p1"]["placement"]["m"][1][2] - flat[0].photo_rows["p1"]["placement"]["m"][1][2]
    assert dy == pytest.approx(pitch_shift(template_box("sedan", "front_left_45")[3], 8.0), abs=1.0)


def test_a_large_tilt_keeps_the_car_in_the_frame():
    # suv front_left_45: box top 0.35 H; at 20° the unclamped shift (about -671 px) would push the roof out
    store, pr, det = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "pitch": 20.0}],
                           background=SHOWROOM, body="suv")
    go(store, pr, det, ["p1"])
    _, top = to_output(store.photo_rows["p1"], CAR[0], CAR[1])
    assert top >= 0.02 * 1920 - 1


def test_an_unsigned_pitch_and_the_studio_stay_level():
    ty = {}
    for name, extra, bg in (("studio_flat", {}, STUDIO), ("studio_tilted", {"pitch": 8.0}, STUDIO),
                            ("showroom_unsigned", {}, SHOWROOM)):  # no pitchSignedDeg: an older capture
        s = setup([{"id": "p1", "slot": "front_left_45", "index": 1, **extra}], background=bg)
        go(*s, ["p1"])
        ty[name] = s[0].photo_rows["p1"]["placement"]["m"][1][2]
    assert ty["studio_tilted"] == pytest.approx(ty["studio_flat"], abs=0.5)
    assert ty["showroom_unsigned"] == pytest.approx(ty["studio_flat"], abs=0.5)


def test_details_ignore_the_showroom():
    store, pr, det = setup([{"id": "p1", "slot": "front", "index": 1}, {"id": "d1", "slot": "detail_wheel", "index": 2}],
                           background=SHOWROOM)
    go(store, pr, det, ["p1", "d1"])
    assert store.photo_rows["d1"]["process_status"] == "done"
    out = decode(store, store.photo_rows["d1"]["output_path"])
    room = showroom_background(SHOWROOM, "sedan", "front")
    assert np.abs(out[40:200, 40:200].astype(int) - room[40:200, 40:200].astype(int)).mean() > 20  # the photo, not a room


def test_a_large_tilt_keeps_a_rolled_car_in_the_frame():
    store, pr, det = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "pitch": 20.0}],
                           background=SHOWROOM, body="suv")
    store.photo_rows["p1"]["capture"]["rollDeg"] = 12.0
    go(store, pr, det, ["p1"])
    row = store.photo_rows["p1"]
    tops = [to_output(row, x, y)[1] for x, y in ((CAR[0], CAR[1]), (CAR[2], CAR[1]))]
    assert abs(min(tops) - 0.02 * 1920) <= 3  # clamped: the roof stops right at the margin


YELLOW = (0.6, 0.9, 1.25)  # garage light, BGR


def car_colour(store, pid):
    row = store.photo_rows[pid]
    x, y = to_output(row, 260, 300)  # on the car, away from the plate
    return decode(store, row["output_path"])[y, x].astype(int)


def test_white_balance_pulls_a_yellow_car_toward_neutral():
    store, pr, det = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "grey": 140, "tint": YELLOW}])
    go(store, pr, det, ["p1"])
    before = np.clip(np.array([140, 140, 140]) * YELLOW, 0, 255)
    after = car_colour(store, "p1")
    assert after.max() - after.min() < 0.6 * (before.max() - before.min())


def test_tone_off_also_skips_white_balance():
    store, pr, det = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "grey": 140, "tint": YELLOW}], tone=False)
    go(store, pr, det, ["p1"])
    before = np.clip(np.array([140, 140, 140]) * YELLOW, 0, 255)
    assert np.abs(car_colour(store, "p1") - before).max() <= 6


def test_old_tone_stats_without_wb_render_unchanged():
    store, pr, det = setup([{"id": "p1", "slot": "front_left_45", "index": 1}])
    go(store, pr, det, ["p1"])
    outputs = []
    for n, wb in enumerate(("missing", None)):
        row = store.photo_rows["p1"]
        stats = {k: v for k, v in row["tone_stats"].items() if k != "wb"}
        if wb != "missing":
            stats["wb"] = wb
        row.update({"tone_stats": stats, "process_status": "queued"})
        go(store, pr, det, ["p1"], clock=lambda n=n: 2000.0 + n)
        assert row["process_status"] == "done"
        outputs.append(decode(store, row["output_path"]))
    assert np.array_equal(outputs[0], outputs[1])
