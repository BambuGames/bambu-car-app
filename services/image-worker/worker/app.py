"""HTTP face of the worker. process-vehicle (Edge Function) posts a vehicle's queued photos to /process."""
import hmac
import logging
import threading
from typing import Callable

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from worker.store import Store

log = logging.getLogger("worker.app")


class Job(BaseModel):
    vehicle_id: str
    photo_ids: list[str]


def create_app(store_factory: Callable[[], Store], runner: Callable[[Store, str, list[str]], dict], secret: str) -> FastAPI:
    app = FastAPI()

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    def run(vehicle_id: str, photo_ids: list[str]) -> None:
        try:
            log.info("vehicle %s: %s", vehicle_id, runner(store_factory(), vehicle_id, photo_ids))
        except Exception:  # noqa: BLE001 — the photos stay processing and can be queued again after 10 min
            log.exception("vehicle %s failed", vehicle_id)

    # Answers at once and processes in the background: the caller (process-vehicle) must not hold the run
    # open. On Cloud Run this needs CPU allocated outside requests (M2c).
    @app.post("/process", status_code=202)
    def process(job: Job, x_worker_secret: str | None = Header(default=None)) -> dict:
        if not secret or not hmac.compare_digest(x_worker_secret or "", secret):
            raise HTTPException(status_code=401, detail="unauthorized")
        threading.Thread(target=run, args=(job.vehicle_id, list(job.photo_ids)), daemon=True).start()
        return {"accepted": len(job.photo_ids)}

    return app
