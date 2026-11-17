"""Export (spec 10): one ZIP of a vehicle's photos for a computer, in listing order and named `01_<slot>.jpg`.
The app decides the order and the selection (photo_ids); the worker skips what has no file for the version."""
import io
import logging
import re
import time
import zipfile

from worker.store import Store

# version → (bucket, column holding the file)
VERSIONS = {
    "watermarked": ("processed", "output_wm_path"),
    "plain": ("processed", "output_path"),
    "originals": ("originals", "original_path"),
}


# export-vehicle signs links for 7 days; a ZIP older than that, plus an hour for clock drift, has no live link.
LINK_MS = (7 * 24 + 1) * 3600 * 1000
EXPORT_FILE = re.compile(r"(?:watermarked|plain|originals)-(\d+)\.zip")

log = logging.getLogger("worker.export")


class NothingToExport(Exception):
    pass


def export_name(index: int, slot: str) -> str:
    """The app's exportName: the same names in the ZIP and in the phone's photos."""
    return f"{index + 1:02d}_{slot}.jpg"


def build_export(store: Store, vehicle_id: str, version: str, photo_ids: list[str], clock=time.time) -> dict:
    bucket, column = VERSIONS[version]
    rows = {p["id"]: p for p in store.photos(vehicle_id)}
    picked = [
        rows[pid] for pid in photo_ids
        if pid in rows and rows[pid].get(column) and (version == "originals" or rows[pid].get("process_status") == "done")
    ]
    if not picked:
        raise NothingToExport
    # ponytail: the whole ZIP is held in memory (40 originals ≈ 200 MB on a 2 GiB instance); spool to a
    # temporary file if sets grow larger.
    buffer = io.BytesIO()
    # JPEGs are compressed already; storing them keeps the ZIP quick to make and to open.
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        for index, p in enumerate(picked):
            archive.writestr(export_name(index, p["slot"]), store.download(bucket, p[column]))
    data = buffer.getvalue()
    vehicle = store.vehicle(vehicle_id)
    # Each export gets its own file, so a link already sent keeps the set it was made for.
    now_ms = int(clock() * 1000)
    folder = f"{vehicle['gallery_id']}/{vehicle_id}/exports"
    path = f"{folder}/{version}-{now_ms}.zip"
    store.upload("processed", path, data, "application/zip")
    _remove_expired(store, folder, keep=path, now_ms=now_ms)
    return {"path": path, "count": len(picked), "bytes": len(data)}


def _remove_expired(store: Store, folder: str, keep: str, now_ms: int) -> None:
    """Drops this vehicle's ZIPs whose links have expired (and old unnumbered ones); the export stands if this fails."""
    def expired(path: str) -> bool:
        match = EXPORT_FILE.fullmatch(path.rsplit("/", 1)[-1])
        return not match or now_ms - int(match.group(1)) > LINK_MS
    try:
        store.remove("processed", [p for p in store.list_files("processed", folder) if p != keep and expired(p)])
    except Exception:  # noqa: BLE001
        log.warning("could not clean up %s", folder, exc_info=True)
