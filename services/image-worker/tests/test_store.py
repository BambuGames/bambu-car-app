import json

import httpx
import pytest

from worker.store import SupabaseStore


def test_store_refuses_paths_that_climb_out_of_a_folder():
    requests = []
    store = SupabaseStore("http://supabase", "key", httpx.Client(transport=httpx.MockTransport(
        lambda r: requests.append(r) or httpx.Response(200, content=b"x"))))
    with pytest.raises(ValueError):
        store.download("originals", "g1/v1/../../branding/g2/logo.png")
    assert requests == []
    assert store.download("originals", "g1/v1/front.jpg") == b"x"


def test_store_lists_the_files_of_a_folder():
    seen = []

    def answer(request):
        seen.append(request)
        return httpx.Response(200, json=[{"name": "plain-1.zip", "id": "a"}, {"name": "sub", "id": None}])

    store = SupabaseStore("http://supabase", "key", httpx.Client(transport=httpx.MockTransport(answer)))
    assert store.list_files("processed", "g1/v1/exports") == ["g1/v1/exports/plain-1.zip"]
    assert seen[0].method == "POST" and seen[0].url.path == "/storage/v1/object/list/processed"
    assert json.loads(seen[0].content)["prefix"] == "g1/v1/exports"
