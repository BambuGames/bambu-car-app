import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from tests.fakes import MemoryStore
from worker.app import create_app
from worker.export import NothingToExport, build_export, export_name

SECRET = "test-secret"
G, V = "g1", "v1"


def photo(pid: str, slot: str, status: str = "done", vehicle: str = V) -> dict:
    return {
        "id": pid, "vehicle_id": vehicle, "gallery_id": G, "slot": slot, "process_status": status,
        "original_path": f"{G}/{vehicle}/{slot}.jpg",
        "output_path": f"{G}/{vehicle}/{pid}/out.jpg" if status == "done" else None,
        "output_wm_path": f"{G}/{vehicle}/{pid}/outwm.jpg" if status == "done" else None,
    }


def store_with(*photos: dict) -> MemoryStore:
    files = {}
    for p in photos:
        files[("originals", p["original_path"])] = f"orig {p['id']}".encode()
        if p["output_path"]:
            files[("processed", p["output_path"])] = f"plain {p['id']}".encode()
            files[("processed", p["output_wm_path"])] = f"wm {p['id']}".encode()
    return MemoryStore(vehicle_rows={V: {"id": V, "gallery_id": G}}, photo_rows={p["id"]: p for p in photos}, files=files)


def zip_entries(store: MemoryStore, path: str) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(store.files[("processed", path)])) as z:
        return {name: z.read(name) for name in z.namelist()}


def test_export_name_numbers_from_01():
    assert export_name(0, "front_left_45") == "01_front_left_45.jpg"
    assert export_name(9, "rear") == "10_rear.jpg"


def test_export_names_follow_the_given_order():
    store = store_with(photo("p1", "front_left_45"), photo("p2", "front"))
    result = build_export(store, V, "watermarked", ["p2", "p1"])
    assert result["path"] == f"{G}/{V}/exports/watermarked.zip"
    assert list(zip_entries(store, result["path"])) == ["01_front.jpg", "02_front_left_45.jpg"]
    assert zip_entries(store, result["path"])["01_front.jpg"] == b"wm p2"


def test_export_skips_photos_without_the_version():
    other = photo("x1", "rear", vehicle="v2")
    store = store_with(photo("p1", "front"), photo("p2", "rear", status="failed"), photo("p3", "left", status="unprocessed"), other)
    result = build_export(store, V, "plain", ["p1", "p2", "p3", "x1"])
    assert result["count"] == 1
    assert zip_entries(store, result["path"]) == {"01_front.jpg": b"plain p1"}


def test_export_of_nothing_is_refused():
    store = store_with(photo("p2", "rear", status="failed"))
    with pytest.raises(NothingToExport):
        build_export(store, V, "watermarked", ["p2"])


def test_originals_come_from_the_originals_bucket():
    store = store_with(photo("p1", "front"), photo("p2", "rear", status="unprocessed"))
    result = build_export(store, V, "originals", ["p1", "p2"])
    assert result["path"] == f"{G}/{V}/exports/originals.zip"
    assert zip_entries(store, result["path"]) == {"01_front.jpg": b"orig p1", "02_rear.jpg": b"orig p2"}


def client(store: MemoryStore) -> TestClient:
    return TestClient(create_app(lambda: store, lambda *a: {}, SECRET))


def test_export_needs_the_worker_secret():
    r = client(store_with(photo("p1", "front"))).post("/export", json={"vehicle_id": V, "version": "plain", "photo_ids": ["p1"]})
    assert r.status_code == 401


def test_export_answers_with_the_zip_path():
    r = client(store_with(photo("p1", "front"))).post(
        "/export", json={"vehicle_id": V, "version": "plain", "photo_ids": ["p1"]}, headers={"x-worker-secret": SECRET})
    assert r.status_code == 200
    assert r.json()["path"] == f"{G}/{V}/exports/plain.zip" and r.json()["count"] == 1


def test_export_of_nothing_answers_409():
    r = client(store_with(photo("p2", "rear", status="failed"))).post(
        "/export", json={"vehicle_id": V, "version": "plain", "photo_ids": ["p2"]}, headers={"x-worker-secret": SECRET})
    assert r.status_code == 409 and r.json() == {"detail": "nothing_to_export"}
