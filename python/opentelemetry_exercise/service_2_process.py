"""Subprocess entry point simulating an integration with no OTel SDK.

This script stands in for a real external system (a legacy script, another
team's CLI, a queue worker written in a different stack) that has no
OpenTelemetry auto-instrumentation for its transport. `Service1` in `app.py`
spawns this file as a subprocess and hands it trace context through
environment variables instead of an HTTP/gRPC call a propagator library would
normally intercept for you.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

from opentelemetry import context as otel_context
from opentelemetry.propagate import extract

from opentelemetry_exercise.app import Service2, configure_telemetry


async def _run(value: str) -> dict[str, object]:
    service_2 = Service2()
    service_2.telemetry = configure_telemetry("service_2")
    try:
        payload = await service_2.double_number(value)
        return dict(payload)
    except ValueError as error:
        return {"value": value, "error": str(error)}
    finally:
        service_2.telemetry.force_flush()
        service_2.telemetry.shutdown()


def main() -> None:
    value = sys.argv[1]

    # The carrier is whatever "headers" a real transport would have carried
    # across the wire. Here it's just the environment variables Service1 set
    # before spawning this process.
    carrier = {"traceparent": os.environ.get("TRACEPARENT", "")}
    if "TRACESTATE" in os.environ:
        carrier["tracestate"] = os.environ["TRACESTATE"]

    # In production, an HTTP server framework's OTel instrumentation (or a
    # gRPC server interceptor) would call `extract` for you on every inbound
    # request. Because this "integration" is just a bare subprocess with no
    # such library, we call it ourselves so the child span below nests under
    # the caller's trace.
    parent_context = extract(carrier)
    token = otel_context.attach(parent_context)
    try:
        result = asyncio.run(_run(value))
    finally:
        otel_context.detach(token)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
