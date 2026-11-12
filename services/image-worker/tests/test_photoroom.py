import io

import httpx
import numpy as np
import pytest
from PIL import Image

from worker.photoroom import Photoroom, PhotoroomError


def alpha_png(w=40, h=30) -> bytes:
    alpha = np.zeros((h, w), np.uint8)
    alpha[5:25, 10:30] = 255
    buf = io.BytesIO()
    Image.fromarray(alpha, "L").save(buf, "PNG")
    return buf.getvalue()


def client(responses: list, seen: list | None = None) -> Photoroom:
    queue = list(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return queue.pop(0)

    return Photoroom("test-key", httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None)


def test_mask_returns_the_alpha():
    mask = client([httpx.Response(200, content=alpha_png())]).mask(b"jpeg")
    assert mask.shape == (30, 40) and mask[15, 20] == 255 and mask[0, 0] == 0


def test_no_credits_is_not_retried():
    seen = []
    with pytest.raises(PhotoroomError) as error:
        client([httpx.Response(402, text="no credits")], seen).mask(b"jpeg")
    assert error.value.code == "photoroom_402" and len(seen) == 1


def test_server_errors_are_retried():
    seen = []
    p = client([httpx.Response(503), httpx.Response(503), httpx.Response(200, content=alpha_png())], seen)
    assert p.mask(b"jpeg").shape == (30, 40)
    assert len(seen) == 3


def test_an_unavailable_service_gives_up():
    with pytest.raises(PhotoroomError) as error:
        client([httpx.Response(503)] * 4).mask(b"jpeg")
    assert error.value.code == "photoroom_unavailable"


def test_the_key_goes_in_the_header():
    seen = []
    client([httpx.Response(200, content=alpha_png())], seen).mask(b"jpeg")
    request = seen[0]
    assert str(request.url) == "https://sdk.photoroom.com/v1/segment"
    assert request.headers["x-api-key"] == "test-key"
    body = request.read().decode("latin-1")
    for field, value in (("format", "png"), ("channels", "alpha"), ("size", "full")):
        assert f'name="{field}"\r\n\r\n{value}' in body
