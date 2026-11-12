"""Photoroom Remove Background (design 7.2.2, M0 Task 3): one alpha mask per exterior photo, $0.02 each.
The mask is stored, so re-renders never call this again."""
import io
import time

import httpx
import numpy as np
from PIL import Image

URL = "https://sdk.photoroom.com/v1/segment"
RETRY_WAITS = (1, 2, 4)  # seconds before each retry of 429, 5xx and timeouts


class PhotoroomError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code} {detail}".strip())
        self.code = code  # photoroom_402 (no credits), photoroom_4xx, photoroom_unavailable


class Photoroom:
    def __init__(self, api_key: str, client: httpx.Client | None = None, sleep=time.sleep):
        self.api_key = api_key
        # 45 s per attempt keeps four attempts (≈ 3 min) well inside the 10 minutes after which a photo
        # counts as stuck and may be queued again.
        self.http = client or httpx.Client(timeout=45)
        self.sleep = sleep

    def mask(self, jpeg: bytes) -> np.ndarray:
        for attempt in range(len(RETRY_WAITS) + 1):
            try:
                r = self.http.post(URL, headers={"x-api-key": self.api_key},
                                   files={"image_file": ("photo.jpg", jpeg, "image/jpeg")},
                                   data={"format": "png", "channels": "alpha", "size": "full"})
            except httpx.TimeoutException:
                r = None
            if r is not None and r.status_code == 200:
                return np.asarray(Image.open(io.BytesIO(r.content)).convert("L"))
            if r is not None and r.status_code == 402:
                raise PhotoroomError("photoroom_402", r.text[:200])
            if r is not None and 400 <= r.status_code < 500 and r.status_code != 429:
                raise PhotoroomError("photoroom_4xx", f"{r.status_code} {r.text[:200]}")
            if attempt < len(RETRY_WAITS):
                self.sleep(RETRY_WAITS[attempt])
        raise PhotoroomError("photoroom_unavailable")
