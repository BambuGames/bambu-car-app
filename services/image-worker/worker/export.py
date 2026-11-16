"""Export (spec 10): one ZIP of a vehicle's photos for a computer, in listing order and named `01_<slot>.jpg`.
The app decides the order and the selection (photo_ids); the worker skips what has no file for the version."""
import io
import zipfile

from worker.store import Store

# version → (bucket, column holding the file)
VERSIONS = {
    "watermarked": ("processed", "output_wm_path"),
    "plain": ("processed", "output_path"),
    "originals": ("originals", "original_path"),
}


class NothingToExport(Exception):
    pass


def export_name(index: int, slot: str) -> str:
    """The app's exportName: the same names in the ZIP and in the phone's photos."""
    return f"{index + 1:02d}_{slot}.jpg"


def build_export(store: Store, vehicle_id: str, version: str, photo_ids: list[str]) -> dict:
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
    # One ZIP per vehicle and version: a new export replaces the last one.
    path = f"{vehicle['gallery_id']}/{vehicle_id}/exports/{version}.zip"
    store.upload("processed", path, data, "application/zip")
    return {"path": path, "count": len(picked), "bytes": len(data)}
