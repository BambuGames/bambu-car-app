"""The running service: `uvicorn worker.main:app` (Dockerfile; locally on port 8090)."""
import logging
import os
from functools import partial

from worker.app import create_app
from worker.config import load_settings
from worker.photoroom import Photoroom
from worker.pipeline import run
from worker.plate import PlateDetector
from worker.store import SupabaseStore
from worker.telemetry import init_sentry

logging.basicConfig(level=logging.INFO)
init_sentry(os.environ.get("SENTRY_DSN"))
settings = load_settings()
store = SupabaseStore(settings.supabase_url, settings.service_key)
runner = partial(run, photoroom=Photoroom(settings.photoroom_key), detector=PlateDetector(settings.plate_model_path))
app = create_app(lambda: store, runner, settings.worker_secret)
