"""Processing a vehicle's queued photos (design 7.2–7.5, 11.3).

Analysis, once per original: EXIF → plates found and covered → Photoroom mask → target car kept → mask
stored, plate corners and tone measured. Rendering, every time: stored mask + touch-up edits → horizon →
placement on the template box → tone toward the set → background, contact shadow → banner → outputs
with and without the watermark. A failure fails only its photo.
"""
import io
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import cv2
import numpy as np
from PIL import Image

from worker import plate as plates_mod
from worker import tone
from worker.backgrounds import render_background
from worker.compose import compose, contact_shadow, encode_jpeg, warp
from worker.imaging import OUT_SIZE, apply_edits, bbox, keep_target, load_upright, placement, solid, straighten
from worker.photoroom import PhotoroomError
from worker.showroom import MAX_PITCH_DEG, pitch_shift, showroom_background
from worker.store import Store
from worker.templates import template_box
from worker.whitebalance import apply_gains, estimate_gains
from worker.watermark import apply_watermark

log = logging.getLogger("worker.pipeline")

EXTERIOR = {"front_left_45", "front", "front_right_45", "right", "rear_right_45", "rear", "rear_left_45", "left"}
# Details where a plate can show; interiors and the other details only gave false banners (phone round 1).
PLATE_DETAIL_SLOTS = {"detail_headlights", "detail_taillights", "detail_trunk_open"}
NO_PLATE_EXPECTED = {"left", "right"}  # a side view, detail or interior without a plate is not flagged
DEFAULT_BACKGROUND = {"kind": "studio", "wall": "#FFFFFF", "floor": "#F2F2F2"}
ANALYSIS_THREADS = 4  # Photoroom answers in about a second; analyse a few photos at once
MIN_CAR_WIDTH = 0.15  # of the photo width: less is a scrap left by a missed car, not a car to place


class PipelineError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _download(store: Store, bucket: str, path: str) -> bytes:
    try:
        return store.download(bucket, path)
    except Exception as e:  # missing file, network: the photo cannot be processed now
        raise PipelineError("download_failed") from e


def _rgba(data: bytes | None) -> np.ndarray | None:
    if data is None:
        return None
    return cv2.cvtColor(np.asarray(Image.open(io.BytesIO(data)).convert("RGBA")), cv2.COLOR_RGBA2BGRA)


def _png(alpha: np.ndarray) -> bytes:
    return cv2.imencode(".png", alpha)[1].tobytes()


def _as3x3(m: np.ndarray) -> np.ndarray:
    return np.vstack([m, [0.0, 0.0, 1.0]])


def _pitch(photo: dict) -> float:
    """The phone's signed tilt (> 0 looking down) within the capture limit; 0 for older captures, which kept
    only its size."""
    value = (photo.get("capture") or {}).get("pitchSignedDeg")
    return float(np.clip(value, -MAX_PITCH_DEG, MAX_PITCH_DEG)) if isinstance(value, (int, float)) else 0.0


def _with_pitch(m: np.ndarray, place: np.ndarray, car_box: tuple[int, int, int, int],
                box: tuple[float, float, float, float], pitch: float) -> np.ndarray:
    """Moves the placed car up or down with the floor under it when the camera looked down or up; never
    further than keeps the car inside the frame (2 % margin). `place` maps the levelled photo, where
    `car_box` lies, onto the output."""
    dy = pitch_shift(box[3], pitch)
    if dy == 0:
        return m
    h = OUT_SIZE[1]
    top = place[1, 1] * car_box[1] + place[1, 2]
    bottom = place[1, 1] * car_box[3] + place[1, 2]
    dy = min(0.0, max(dy, 0.02 * h - top)) if dy < 0 else max(0.0, min(dy, 0.98 * h - bottom))
    out = m.copy()
    out[1, 2] += dy
    return out


def _folder(photo: dict) -> str:
    return f"{photo['gallery_id']}/{photo['vehicle_id']}/{photo['id']}"


def _analyze(store: Store, photo: dict, photoroom, detector) -> dict:
    """Fields to store for a photo that has not been analysed since its original was taken."""
    image = load_upright(_download(store, "originals", photo["original_path"]))
    found = detector.detect(image) if photo["slot"] in EXTERIOR | PLATE_DETAIL_SLOTS else []
    h, w = image.shape[:2]
    fields: dict = {}
    if photo["slot"] in EXTERIOR:
        # Every plate is covered before the photo leaves (design 7.2.2); which one is the target car's is
        # known only from the mask.
        alpha = photoroom.mask(encode_jpeg(plates_mod.cover(image, [box for _, box in found]), 92))
        if alpha.shape != (h, w):
            alpha = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_LINEAR)
        alpha = plates_mod.restore_covered(alpha, [box for _, box in found])
        target = (photo.get("capture") or {}).get("targetBox")
        alpha = keep_target(alpha, tuple(target) if target else None)
        # Checked here, before anything is stored: an empty mask must not pull the set's tone target.
        car = bbox(alpha)
        if car is None:
            raise PipelineError("empty_mask")
        if car[2] - car[0] < MIN_CAR_WIDTH * w:
            raise PipelineError("car_too_small")
        mask_path = f"{_folder(photo)}/mask.png"
        store.upload("processed", mask_path, _png(alpha), "image/png")
        fields["mask_path"] = mask_path
        # Measured after the white balance, which the render applies first when colour matching is on.
        wb = estimate_gains(image, alpha)
        fields["tone_stats"] = {**tone.measure(apply_gains(image, wb), alpha), "wb": wb}
        plate_box = plates_mod.pick_target(found, alpha)
    else:
        plate_box = found[0][1] if found else None
    if plate_box is not None:
        corners = plates_mod.refine_corners(image, plate_box)
        fields["plate_corners"] = [[float(x) / w, float(y) / h] for x, y in corners]
        fields["plate_status"] = "auto"  # every placement waits for the quick check (M0 decision)
    else:
        fields["plate_corners"] = None
        fields["plate_status"] = "needs_check" if photo["slot"] in EXTERIOR - NO_PLATE_EXPECTED else "none"
    return fields


def _render(store: Store, photo: dict, vehicle: dict, ctx: dict, now_ms: int) -> dict:
    image = load_upright(_download(store, "originals", photo["original_path"]))
    h, w = image.shape[:2]
    clip = None  # the banner stays on the car where there is a car mask
    if photo["slot"] in EXTERIOR:
        if ctx["target"] is not None:  # colour matching on: neutral light first, then the set's tone
            image = apply_gains(image, (photo.get("tone_stats") or {}).get("wb"))
        alpha = cv2.imdecode(np.frombuffer(_download(store, "processed", photo["mask_path"]), np.uint8), cv2.IMREAD_GRAYSCALE)
        if alpha is None or alpha.shape != (h, w):
            raise PipelineError("stale_mask")  # not this original's mask: placing it would misalign the car
        alpha = apply_edits(alpha, photo.get("mask_edits") or [])
        _, alpha_level, m_level = straighten(image, alpha, (photo.get("capture") or {}).get("rollDeg"))
        car_box = bbox(alpha_level)
        box = template_box(vehicle["body_type"], photo["slot"])
        if car_box is None:
            raise PipelineError("empty_mask")
        if box is None:
            raise PipelineError("internal")
        place = placement(car_box, box)
        m = (_as3x3(place) @ _as3x3(m_level))[:2]
        background = ctx["background"]
        if ctx["showroom"] is not None:  # the room from this slot's camera; the car moves with its floor
            pitch = _pitch(photo)
            background = showroom_background(ctx["showroom"], vehicle["body_type"], photo["slot"], pitch)
            m = _with_pitch(m, place, car_box, box, pitch)
        car, car_alpha = warp(image, m, OUT_SIZE), warp(alpha, m, OUT_SIZE)
        if ctx["target"] is not None and photo.get("tone_stats"):
            car = tone.apply(car, tone.correction(photo["tone_stats"], ctx["target"]), car_alpha)
        out = compose(background, car, car_alpha, contact_shadow(car_alpha))
        clip = solid(car_alpha)
    else:
        # Detail and interior (design 7.3): the photo itself, 4:3, with the set's mean tone correction.
        crop_w, crop_h = min(w, h * 4 // 3), min(h, w * 3 // 4)
        s = OUT_SIZE[0] / crop_w
        m = np.array([[s, 0, -s * (w - crop_w) / 2], [0, s, -s * (h - crop_h) / 2]])
        out = cv2.warpAffine(image, m, OUT_SIZE, flags=cv2.INTER_AREA)
        if ctx["detail_wb"] is not None:
            out = apply_gains(out, ctx["detail_wb"])
        if ctx["detail_correction"] is not None:
            out = tone.apply(out, ctx["detail_correction"])

    corners = photo.get("plate_corners")
    if ctx["banner"] is not None and corners and photo.get("plate_status") in ("auto", "confirmed"):
        px = np.array([[x * w, y * h, 1.0] for x, y in corners])
        out = plates_mod.warp_banner(out, ctx["banner"], (m @ px.T).T, clip)

    marked = apply_watermark(out, ctx["logo"], ctx["watermark"])
    folder = _folder(photo)
    plain_path, marked_path = f"{folder}/out-{now_ms}.jpg", f"{folder}/outwm-{now_ms}.jpg"
    store.upload("processed", plain_path, encode_jpeg(out), "image/jpeg")
    store.upload("processed", marked_path, encode_jpeg(marked), "image/jpeg")
    return {
        "process_status": "done",
        "process_error": None,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "output_path": plain_path,
        "output_wm_path": marked_path,
        "placement": {"m": m.tolist(), "src": [w, h]},
    }


def _context(store: Store, vehicle: dict, photos: list[dict]) -> dict:
    """What every render of this vehicle shares: background, branding and the set's tone target."""
    gallery = vehicle.get("gallery") or {}
    spec = (vehicle.get("background") or {}).get("spec") or DEFAULT_BACKGROUND
    showroom = spec if spec.get("kind") == "showroom" else None  # drawn per photo, from its slot's camera
    background = None if showroom else render_background(spec, OUT_SIZE, lambda path: cv2.imdecode(
        np.frombuffer(_download(store, "backgrounds", path), np.uint8), cv2.IMREAD_COLOR))
    stats = [p["tone_stats"] for p in photos if p["slot"] in EXTERIOR and p.get("tone_stats")]
    target = tone.set_target(stats) if vehicle.get("tone_enabled", True) else None
    detail = None if target is None else tone.mean_correction([tone.correction(s, target) for s in stats])
    # Details and interiors have no mask to read the light around: the set's mean white balance.
    wbs = [s.get("wb") for s in stats]
    detail_wb = None
    if target is not None and any(wbs):
        detail_wb = [float(np.mean([(w or (1.0, 1.0, 1.0))[i] for w in wbs])) for i in range(3)]
    branding = lambda key: _rgba(_download(store, "branding", gallery[key])) if gallery.get(key) else None  # noqa: E731
    return {"background": background, "showroom": showroom, "target": target, "detail_correction": detail,
            "detail_wb": detail_wb,
            "banner": branding("banner_path"), "logo": branding("logo_path"), "watermark": gallery.get("watermark") or {}}


def _warm_room(spec: dict, body_type: str, slot: str, pitch: float) -> None:
    try:
        showroom_background(spec, body_type, slot, pitch)
    except Exception:  # noqa: BLE001 — the render of that photo reports it
        log.warning("could not draw the showroom for %s", slot)


def _fail(store: Store, photo_id: str, error: Exception, expect: dict) -> None:
    code = error.code if isinstance(error, (PipelineError, PhotoroomError)) else "internal"
    if code == "internal":
        log.exception("photo %s failed", photo_id, exc_info=error)
    store.update_photo(photo_id, {"process_status": "failed", "process_error": code}, expect=expect)


def run(store: Store, vehicle_id: str, photo_ids: list[str], photoroom, detector, clock=time.time) -> dict:
    vehicle = store.vehicle(vehicle_id)
    wanted = set(photo_ids)
    # Claim each queued photo for this run, with the original it has now. Every later write holds only while
    # the row is still processing that same original: a photo re-shot (the trigger resets it) or claimed by
    # another run meanwhile is left to them, never overwritten with stale results.
    claimed: dict[str, str] = {}
    for p in store.photos(vehicle_id):
        if p["id"] in wanted and store.update_photo(
                p["id"], {"process_status": "processing"}, expect={"process_status": "queued", "captured_at": p["captured_at"]}):
            claimed[p["id"]] = p["captured_at"]

    def mine(photo_id: str) -> dict:
        return {"process_status": "processing", "captured_at": claimed[photo_id]}

    failed: set[str] = set()
    gone: set[str] = set()

    def fail(photo_id: str, error: Exception) -> None:
        failed.add(photo_id)
        _fail(store, photo_id, error, mine(photo_id))

    def analyze(p: dict) -> None:
        needs = p.get("mask_path") is None if p["slot"] in EXTERIOR else p.get("plate_status") is None
        if not needs:
            return
        try:
            if not store.update_photo(p["id"], _analyze(store, p, photoroom, detector), expect=mine(p["id"])):
                gone.add(p["id"])
        except Exception as e:  # noqa: BLE001 — one photo's failure must not stop the others
            fail(p["id"], e)

    to_analyze = [p for p in store.photos(vehicle_id) if p["id"] in claimed]
    spec = (vehicle.get("background") or {}).get("spec") or DEFAULT_BACKGROUND
    with ThreadPoolExecutor(ANALYSIS_THREADS) as pool:
        if spec.get("kind") == "showroom":  # draw the rooms while Photoroom works; rendering finds them cached
            for slot, pitch in {(p["slot"], _pitch(p)) for p in to_analyze if p["slot"] in EXTERIOR}:
                pool.submit(_warm_room, spec, vehicle["body_type"], slot, pitch)
        list(pool.map(analyze, to_analyze))

    photos = store.photos(vehicle_id)  # with this run's analysis: the tone target needs the whole set
    try:
        ctx = _context(store, vehicle, photos)
    except Exception as e:  # noqa: BLE001 — no background or branding: every claimed photo fails
        ctx = None
        for photo_id in claimed:
            if photo_id not in failed | gone:
                fail(photo_id, e)

    now_ms = int(clock() * 1000)
    done = 0
    for p in photos:
        if p["id"] not in claimed or p["id"] in failed | gone or p["captured_at"] != claimed[p["id"]]:
            continue
        try:
            fields = _render(store, p, vehicle, ctx, now_ms)
        except Exception as e:  # noqa: BLE001
            fail(p["id"], e)
            continue
        if store.update_photo(p["id"], fields, expect=mine(p["id"])):
            store.remove("processed", [x for x in (p.get("output_path"), p.get("output_wm_path"))
                                       if x and x not in (fields["output_path"], fields["output_wm_path"])])
            done += 1
        else:
            store.remove("processed", [fields["output_path"], fields["output_wm_path"]])

    if not any(p["process_status"] in ("queued", "processing") for p in store.photos(vehicle_id)):
        store.update_vehicle(vehicle_id, {"status": "ready"}, expect={"status": "processing"})  # never un-archive
    return {"done": done, "failed": len(failed)}
