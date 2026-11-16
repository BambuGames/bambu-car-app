from worker.telemetry import init_sentry, scrub_event


def test_scrub_event_drops_secret_headers_and_query():
    event = {"request": {"url": "https://w.run.app/export?token=t", "query_string": "token=t",
                         "headers": {"X-Worker-Secret": "s", "Authorization": "Bearer x", "Content-Type": "application/json"}}}
    scrubbed = scrub_event(event, {})
    assert scrubbed["request"]["url"] == "https://w.run.app/export"
    assert "query_string" not in scrubbed["request"]
    assert scrubbed["request"]["headers"] == {"Content-Type": "application/json"}


def test_scrub_event_leaves_events_without_a_request_alone():
    assert scrub_event({"message": "m"}, {}) == {"message": "m"}


def test_no_dsn_means_no_sentry():
    assert init_sentry(None) is False
    assert init_sentry("") is False


def test_frame_locals_never_reach_sentry():
    # A 500 inside /export has the handler's frame, with x_worker_secret, in its traceback.
    import sentry_sdk
    from sentry_sdk.transport import Transport

    sent = []

    class Capture(Transport):
        def capture_envelope(self, envelope):
            sent.append(envelope)

    assert init_sentry("https://k@o1.ingest.de.sentry.io/1")
    try:
        sentry_sdk.get_client().transport = Capture()

        def export(x_worker_secret):
            raise RuntimeError("storage down")

        try:
            export("shared-" + "secret-value")  # joined at run time, so the source lines Sentry sends hold no secret
        except RuntimeError:
            sentry_sdk.capture_exception()
        sentry_sdk.flush()
        payload = b"".join(item.payload.get_bytes() for envelope in sent for item in envelope.items)
        assert b"storage down" in payload
        assert b"shared-secret-value" not in payload
    finally:
        sentry_sdk.init()  # no DSN: the other tests run without Sentry
