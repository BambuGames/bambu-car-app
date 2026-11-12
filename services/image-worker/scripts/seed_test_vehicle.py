"""Local end-to-end check: a test vehicle in Testgalerie with one real M0 photo per exterior slot (different
cars, body type 'other', simple mode: no target box), then processing started as the dev owner.

usage (repo root, local Supabase running, worker on port 8090):
  set -a && eval "$(npx supabase status -o env)" && set +a && \
  services/image-worker/.venv/bin/python services/image-worker/scripts/seed_test_vehicle.py [--process] [--details]
--details puts the same photos on detail and interior slots: no Photoroom call, nothing spent.
Prints the vehicle id. Uses the service role from `supabase status` and the seed's dev password.
"""
import csv
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import httpx
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
TESTGALERIE = "e0000000-0000-0000-0000-000000000001"
SLOTS = ["front_left_45", "front", "front_right_45", "right", "rear_right_45", "rear", "rear_left_45", "left"]
DETAIL_SLOTS = ["detail_wheel", "detail_headlights", "detail_taillights", "detail_trunk_open", "detail_engine",
                "detail_roof", "interior_cockpit", "interior_console"]


def branding(http: httpx.Client, url: str, admin: dict) -> None:
    """A made-up banner and logo for Testgalerie (local only), so the run shows both."""
    banner = np.full((110, 520, 4), 255, np.uint8)
    cv2.rectangle(banner, (0, 0), (519, 109), (20, 20, 20, 255), 6)
    cv2.putText(banner, "AUTOHAUS TEST", (40, 72), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (20, 20, 20, 255), 4)
    logo = np.zeros((120, 360, 4), np.uint8)
    cv2.putText(logo, "AH TEST", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 2.6, (255, 255, 255, 255), 8)
    for name, rgba in (("banner.png", banner), ("logo.png", logo)):
        data = cv2.imencode(".png", cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))[1].tobytes()
        http.post(f"{url}/storage/v1/object/branding/{TESTGALERIE}/{name}", content=data,
                  headers={**admin, "Content-Type": "image/png", "x-upsert": "true"}).raise_for_status()
    http.patch(f"{url}/rest/v1/galleries", params={"id": f"eq.{TESTGALERIE}"}, headers=admin, json={
        "banner_path": f"{TESTGALERIE}/banner.png", "logo_path": f"{TESTGALERIE}/logo.png",
        "watermark": {"position": "bottom_right", "width": 0.18, "opacity": 0.85}}).raise_for_status()


def main() -> None:
    url, service = os.environ["API_URL"], os.environ["SERVICE_ROLE_KEY"]
    admin = {"apikey": service, "Authorization": f"Bearer {service}"}
    rows = list(csv.DictReader(open(ROOT / "spikes/data/photos.csv")))
    picks = {slot: next(r["file"] for r in rows if r["slot"] == slot and r["lens"] == "main") for slot in SLOTS}
    if "--details" in sys.argv:
        picks = dict(zip(DETAIL_SLOTS, picks.values()))

    vehicle_id = str(uuid.uuid4())
    http = httpx.Client(timeout=60)
    branding(http, url, admin)
    http.post(f"{url}/rest/v1/vehicles", headers=admin, json={
        "id": vehicle_id, "gallery_id": TESTGALERIE, "make": "Test", "model": "M0-Set", "body_type": "other",
        "status": "shooting"}).raise_for_status()
    now = datetime.now(timezone.utc).isoformat()
    for slot, name in picks.items():
        path = f"{TESTGALERIE}/{vehicle_id}/{slot}.jpg"
        http.post(f"{url}/storage/v1/object/originals/{path}", content=(ROOT / "spikes/data/photos" / name).read_bytes(),
                  headers={**admin, "Content-Type": "image/jpeg"}).raise_for_status()
        http.post(f"{url}/rest/v1/photos", headers=admin, json={
            "id": str(uuid.uuid4()), "vehicle_id": vehicle_id, "gallery_id": TESTGALERIE, "slot": slot,
            "original_path": path, "captured_at": now, "capture": {"rollDeg": 0, "simpleMode": True, "source": name},
        }).raise_for_status()
    print(vehicle_id)

    if "--process" in sys.argv:
        anon = os.environ["ANON_KEY"]
        token = http.post(f"{url}/auth/v1/token", params={"grant_type": "password"}, headers={"apikey": anon},
                          json={"email": "owner@bambu.test", "password": "dev-password-1"}).raise_for_status().json()["access_token"]
        r = http.post(f"{url}/functions/v1/process-vehicle", headers={"apikey": anon, "Authorization": f"Bearer {token}"},
                      json={"vehicleId": vehicle_id})
        print(r.status_code, r.text, file=sys.stderr)


if __name__ == "__main__":
    main()
