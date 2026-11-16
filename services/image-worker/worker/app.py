"""HTTP face of the worker. process-vehicle (Edge Function) posts a vehicle's queued photos to /process;
export-vehicle asks /export for a ZIP of a vehicle's photos."""
import hmac
import logging
import threading
from typing import Callable, Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from worker.export import NothingToExport, build_export
from worker.store import Store

log = logging.getLogger("worker.app")


class Job(BaseModel):
    vehicle_id: str
    photo_ids: list[str]


class ExportJob(BaseModel):
    vehicle_id: str
    version: Literal["watermarked", "plain", "originals"]
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

    def check(x_worker_secret: str | None) -> None:
        if not secret or not hmac.compare_digest(x_worker_secret or "", secret):
            raise HTTPException(status_code=401, detail="unauthorized")

    # Answers at once and processes in the background: the caller (process-vehicle) must not hold the run
    # open. On Cloud Run this needs CPU allocated outside requests (M2c).
    @app.post("/process", status_code=202)
    def process(job: Job, x_worker_secret: str | None = Header(default=None)) -> dict:
        check(x_worker_secret)
        threading.Thread(target=run, args=(job.vehicle_id, list(job.photo_ids)), daemon=True).start()
        return {"accepted": len(job.photo_ids)}

    # Answers when the ZIP is stored: export-vehicle signs a link to it right away. Plain def, so FastAPI runs
    # it in its thread pool and /health stays free meanwhile.
    @app.post("/export")
    def export(job: ExportJob, x_worker_secret: str | None = Header(default=None)) -> dict:
        check(x_worker_secret)
        try:
            return build_export(store_factory(), job.vehicle_id, job.version, list(job.photo_ids))
        except NothingToExport:
            raise HTTPException(status_code=409, detail="nothing_to_export") from None

    return app
