"""Supabase access for the worker: rows over PostgREST and files over the Storage API, as the service role."""
from typing import Protocol
from urllib.parse import quote

import httpx


class Store(Protocol):
    def vehicle(self, vehicle_id: str) -> dict:
        """The vehicle row with `gallery` (watermark, logo_path, banner_path) and `background` (spec)."""

    def photos(self, vehicle_id: str) -> list[dict]: ...

    def update_photo(self, photo_id: str, fields: dict, expect: dict | None = None) -> bool:
        """Writes only while the row still matches `expect` (column → value); False when it no longer does."""

    def update_vehicle(self, vehicle_id: str, fields: dict, expect: dict | None = None) -> bool: ...

    def download(self, bucket: str, path: str) -> bytes: ...

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None: ...

    def remove(self, bucket: str, paths: list[str]) -> None: ...

    def list_files(self, bucket: str, prefix: str) -> list[str]: ...


class SupabaseStore:
    def __init__(self, url: str, service_key: str, client: httpx.Client | None = None):
        self.url = url.rstrip("/")
        self.http = client or httpx.Client(timeout=60)
        self.headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    def _rest(self, method: str, table: str, params: dict, json=None) -> httpx.Response:
        r = self.http.request(method, f"{self.url}/rest/v1/{table}", params=params, json=json,
                              headers={**self.headers, "Prefer": "return=representation"})
        r.raise_for_status()
        return r

    def vehicle(self, vehicle_id: str) -> dict:
        select = "*,gallery:galleries(watermark,logo_path,banner_path),background:backgrounds(spec)"
        rows = self._rest("GET", "vehicles", {"id": f"eq.{vehicle_id}", "select": select}).json()
        if not rows:
            raise LookupError(f"vehicle {vehicle_id} not found")
        return rows[0]

    def photos(self, vehicle_id: str) -> list[dict]:
        return self._rest("GET", "photos", {"vehicle_id": f"eq.{vehicle_id}", "select": "*"}).json()

    def _update(self, table: str, row_id: str, fields: dict, expect: dict | None) -> bool:
        params = {"id": f"eq.{row_id}", **{k: f"eq.{v}" for k, v in (expect or {}).items()}}
        return bool(self._rest("PATCH", table, params, json=fields).json())

    def update_photo(self, photo_id: str, fields: dict, expect: dict | None = None) -> bool:
        return self._update("photos", photo_id, fields, expect)

    def update_vehicle(self, vehicle_id: str, fields: dict, expect: dict | None = None) -> bool:
        return self._update("vehicles", vehicle_id, fields, expect)

    def _object(self, bucket: str, path: str) -> str:
        # Paths come from rows members can write; httpx would resolve "..", so refuse it outright.
        if any(part in ("", ".", "..") for part in path.split("/")):
            raise ValueError(f"unsafe storage path: {path!r}")
        return f"{self.url}/storage/v1/object/{bucket}/{quote(path)}"

    def download(self, bucket: str, path: str) -> bytes:
        r = self.http.get(self._object(bucket, path), headers=self.headers)
        r.raise_for_status()
        return r.content

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        r = self.http.post(self._object(bucket, path), content=data,
                           headers={**self.headers, "Content-Type": content_type, "x-upsert": "true"})
        r.raise_for_status()

    def list_files(self, bucket: str, prefix: str) -> list[str]:
        """Paths of the files directly in a folder (no subfolders), up to 1000."""
        r = self.http.post(f"{self.url}/storage/v1/object/list/{bucket}",
                           json={"prefix": prefix, "limit": 1000, "offset": 0}, headers=self.headers)
        r.raise_for_status()
        return [f"{prefix}/{o['name']}" for o in r.json() if o.get("id")]

    def remove(self, bucket: str, paths: list[str]) -> None:
        if paths:
            r = self.http.request("DELETE", f"{self.url}/storage/v1/object/{bucket}", json={"prefixes": paths},
                                  headers=self.headers)
            r.raise_for_status()
