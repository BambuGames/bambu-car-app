"""One PNG per vehicle: each photo's original next to its watermarked output, with slot, status and plate state.

usage (repo root): set -a && eval "$(npx supabase status -o env)" && set +a && \
  services/image-worker/.venv/bin/python services/image-worker/scripts/contact_sheet.py <vehicle_id>
Writes services/image-worker/out/<vehicle_id>.png (git-ignored).
"""
import os
import sys
from pathlib import Path

import cv2
import httpx
import numpy as np

OUT = Path(__file__).resolve().parents[1] / "out"
CELL = (640, 480)


def main(vehicle_id: str) -> None:
    url, service = os.environ["API_URL"], os.environ["SERVICE_ROLE_KEY"]
    headers = {"apikey": service, "Authorization": f"Bearer {service}"}
    http = httpx.Client(timeout=60)
    photos = http.get(f"{url}/rest/v1/photos", headers=headers,
                      params={"vehicle_id": f"eq.{vehicle_id}", "select": "*", "order": "slot"}).json()

    def image(bucket: str, path: str | None) -> np.ndarray:
        cell = np.full((CELL[1], CELL[0], 3), 40, np.uint8)
        if path:
            r = http.get(f"{url}/storage/v1/object/{bucket}/{path}", headers=headers)
            if r.status_code == 200:
                img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
                h, w = img.shape[:2]
                s = min(CELL[0] / w, CELL[1] / h)
                small = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
                cell[: small.shape[0], : small.shape[1]] = small
        return cell

    rows = []
    for p in photos:
        row = np.hstack([image("originals", p["original_path"]), image("processed", p.get("output_wm_path"))])
        label = f"{p['slot']}  {p['process_status']}{' ' + p['process_error'] if p.get('process_error') else ''}  plate: {p.get('plate_status')}"
        cv2.putText(row, label, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
        cv2.putText(row, label, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        rows.append(row)
    OUT.mkdir(exist_ok=True)
    dest = OUT / f"{vehicle_id}.png"
    cv2.imwrite(str(dest), np.vstack(rows))
    print(dest)


if __name__ == "__main__":
    main(sys.argv[1])
