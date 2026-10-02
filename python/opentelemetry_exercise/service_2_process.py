"""Service 2 implementation and subprocess entry point.

`Service1` in `app.py` spawns this file as a subprocess and hands it trace
context through environment variables instead of an HTTP/gRPC call an
instrumented transport would normally propagate automatically.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from functools import cached_property

from opentelemetry import context as otel_context
from opentelemetry import metrics, trace
from opentelemetry.propagate import extract
from opentelemetry.trace import Status, StatusCode

from opentelemetry_exercise.utils import (
    DoubleResult,
    TelemetryBundle,
    configure_telemetry,
    meter_for,
    service_logger,
    trace_id_hex,
    tracer_for,
)


class Service2:
    def __init__(self) -> None:
        self.logger = service_logger("service_2")
        self.telemetry = TelemetryBundle()

    @cached_property
    def tracer(self) -> trace.Tracer:
        return tracer_for("service_2", self.telemetry)

    @cached_property
    def meter(self) -> metrics.Meter:
        return meter_for("service_2", self.telemetry)

    @cached_property
    def doubled_counter(self):
        return self.meter.create_counter("otel_numbers_doubled_total")

    @cached_property
    def error_counter(self):
        return self.meter.create_counter("otel_number_errors_total")

    @cached_property
    def duration_histogram(self):
        return self.meter.create_histogram("otel_double_duration_ms")

    async def double_number(self, value: str) -> DoubleResult:
        start = time.perf_counter()
        with self.tracer.start_as_current_span("service_2.double_number") as span:
            span.set_attribute("service_2.message.value", value)
            try:
                number = int(value)
            except ValueError as error:
                self.error_counter.add(1)
                span.record_exception(error)
                span.set_status(Status(StatusCode.ERROR, str(error)))
                self.logger.exception("invalid number received: %s", value)
                raise ValueError("value must be numeric") from error

            doubled = number * 2
            self.doubled_counter.add(1)
            self.duration_histogram.record((time.perf_counter() - start) * 1000)
            self.logger.info("doubled %s to %s", number, doubled)
            return {
                "value": value,
                "doubled": doubled,
                "trace_id": trace_id_hex(span),
            }


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
