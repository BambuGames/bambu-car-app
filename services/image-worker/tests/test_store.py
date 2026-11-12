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
