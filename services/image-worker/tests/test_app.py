import threading
import time

from fastapi.testclient import TestClient

from tests.fakes import MemoryStore
from worker.app import create_app

SECRET = "test-secret"


def client(runner):
    store = MemoryStore()
    return TestClient(create_app(lambda: store, runner, SECRET)), store


def test_health():
    c, _ = client(lambda *a: {})
    r = c.get("/health")
    assert r.status_code == 200 and r.json() == {"ok": True}


def test_process_rejects_a_wrong_secret():
    calls = []
    c, _ = client(lambda *a: calls.append(a) or {})
    r = c.post("/process", json={"vehicle_id": "v1", "photo_ids": ["p1"]}, headers={"x-worker-secret": "nope"})
    assert r.status_code == 401
    assert calls == []


def test_process_answers_at_once_and_runs_in_the_background():
    started, release, calls = threading.Event(), threading.Event(), []

    def runner(*args):
        started.set()
        release.wait(5)
        calls.append(args)
        return {"done": 2, "failed": 0}

    c, store = client(runner)
    r = c.post("/process", json={"vehicle_id": "v1", "photo_ids": ["p1", "p2"]}, headers={"x-worker-secret": SECRET})
    assert r.status_code == 202 and r.json() == {"accepted": 2}
    assert started.wait(5) and calls == []  # answered while the run is still going
    release.set()
    for _ in range(50):
        if calls:
            break
        time.sleep(0.05)
    assert calls == [(store, "v1", ["p1", "p2"])]
