"""Settings from the environment (Cloud Run secrets, or .env locally)."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    service_key: str
    photoroom_key: str
    worker_secret: str
    plate_model_path: str


def load_settings() -> Settings:
    env = os.environ
    return Settings(
        supabase_url=env["SUPABASE_URL"].rstrip("/"),
        service_key=env["SUPABASE_SERVICE_ROLE_KEY"],
        photoroom_key=env["PHOTOROOM_API_KEY"],
        worker_secret=env["WORKER_SECRET"],
        plate_model_path=env.get("PLATE_MODEL_PATH", "models/plate_rtdetrv2.onnx"),
    )
