"""Sentry for the worker (spec 11.1, EU data region). Off without SENTRY_DSN. Errors logged with log.exception
(a photo's internal failure, a vehicle run that crashed) arrive through Sentry's logging integration.
No personal data is sent, and the shared secret and query strings are taken out of request data. Stack frames
go without their local variables: a handler's frame holds x_worker_secret, and Sentry's denylist misses it."""
import sentry_sdk

SECRET_HEADERS = {"x-worker-secret", "authorization", "cookie"}


def scrub_event(event: dict, hint: dict) -> dict:
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("query_string", None)
        if isinstance(request.get("url"), str):
            request["url"] = request["url"].split("#", 1)[0].split("?", 1)[0]
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {k: v for k, v in headers.items() if k.lower() not in SECRET_HEADERS}
    return event


def init_sentry(dsn: str | None) -> bool:
    if not dsn:
        return False
    # No send_default_pii: 2.75 deprecates it, and left unset the SDK sends no personal data and keeps its own
    # event scrubber (setting the newer data_collection would turn that scrubber off).
    sentry_sdk.init(dsn=dsn, include_local_variables=False, before_send=scrub_event, traces_sample_rate=0)
    return True
