"""In-memory stand-ins for Supabase (and, from Task 8, Photoroom and the plate detector)."""
import copy


class MemoryStore:
    """Store protocol on dictionaries: vehicle and photo rows by id, files by (bucket, path)."""

    def __init__(self, vehicle_rows: dict | None = None, photo_rows: dict | None = None, files: dict | None = None):
        self.vehicle_rows = vehicle_rows or {}
        self.photo_rows = photo_rows or {}
        self.files = files or {}

    def vehicle(self, vehicle_id: str) -> dict:
        return copy.deepcopy(self.vehicle_rows[vehicle_id])

    def photos(self, vehicle_id: str) -> list[dict]:
        return [copy.deepcopy(p) for p in self.photo_rows.values() if p["vehicle_id"] == vehicle_id]

    @staticmethod
    def _update(row: dict, fields: dict, expect: dict | None) -> bool:
        if any(row.get(k) != v for k, v in (expect or {}).items()):
            return False
        row.update(copy.deepcopy(fields))
        return True

    def update_photo(self, photo_id: str, fields: dict, expect: dict | None = None) -> bool:
        return self._update(self.photo_rows[photo_id], fields, expect)

    def update_vehicle(self, vehicle_id: str, fields: dict, expect: dict | None = None) -> bool:
        return self._update(self.vehicle_rows[vehicle_id], fields, expect)

    def download(self, bucket: str, path: str) -> bytes:
        return self.files[(bucket, path)]

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        self.files[(bucket, path)] = data

    def remove(self, bucket: str, paths: list[str]) -> None:
        for path in paths:
            self.files.pop((bucket, path), None)


class FakePhotoroom:
    """Returns a mask per call from `mask_for(jpeg)`; remembers every image it was sent."""

    def __init__(self, mask_for):
        self.mask_for = mask_for
        self.sent: list[bytes] = []

    def mask(self, jpeg: bytes):
        self.sent.append(jpeg)
        result = self.mask_for(jpeg)
        if isinstance(result, Exception):
            raise result
        return result


class FakeDetector:
    def __init__(self, plates_for):
        self.plates_for = plates_for

    def detect(self, image):
        return self.plates_for(image)
