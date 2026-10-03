from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
from collections.abc import Sequence
from functools import cached_property
from pathlib import Path
from typing import Any

from opentelemetry import metrics, trace
from opentelemetry.propagate import inject
from opentelemetry.trace import Status, StatusCode

from opentelemetry_exercise.utils import (
    DEFAULT_MESSAGES,
    DoubleResult,
    FailureResult,
    TelemetryBundle,
    WorkflowResult,
    configure_telemetry,
    meter_for,
    service_logger,
    tracer_for,
)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Service1:
    def __init__(self) -> None:
        self.logger = service_logger("service_1")
        self.telemetry = TelemetryBundle()

    @cached_property
    def tracer(self) -> trace.Tracer:
        return tracer_for("service_1", self.telemetry)

    @cached_property
    def meter(self) -> metrics.Meter:
        return meter_for("service_1", self.telemetry)

    @cached_property
    def sent_counter(self):
        return self.meter.create_counter("otel_messages_sent_total")

    @cached_property
    def failure_counter(self):
        return self.meter.create_counter("otel_messages_failed_total")

    @cached_property
    def latency_histogram(self):
        return self.meter.create_histogram("otel_message_round_trip_ms")

    def _call_service_2(self, value: str) -> DoubleResult:
        """Call service_2 across a subprocess boundary, propagating trace
        context by hand through environment variables.

        `service_2_process.py` simulates an external integration with no
        OTel SDK of its own (e.g. a legacy script or another team's CLI), so
        there's no propagator library sitting in an HTTP/gRPC layer to do
        this automatically. In production, prefer an existing
        instrumentation (e.g. `opentelemetry-instrumentation-requests`, or a
        gRPC client interceptor) that calls `inject` for you on every
        outbound call.
        """
        carrier: dict[str, str] = {}
        inject(carrier)

        env = dict(os.environ)
        if "traceparent" in carrier:
            env["TRACEPARENT"] = carrier["traceparent"]
        if "tracestate" in carrier:
            env["TRACESTATE"] = carrier["tracestate"]

        completed = subprocess.run(
            [sys.executable, "-m", "opentelemetry_exercise.service_2_process", value],
            env=env,
            cwd=_PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        result: dict[str, Any] = json.loads(completed.stdout)
        if "error" in result:
            raise ValueError(result["error"])
        return result

    async def send_numbers_to_service_2(
        self,
        messages: Sequence[str] = DEFAULT_MESSAGES,
    ) -> WorkflowResult:
        results: list[DoubleResult] = []
        failures: list[FailureResult] = []

        for index, raw_value in enumerate(messages, start=1):
            start = time.perf_counter()
            with self.tracer.start_as_current_span("service_1.send_number") as span:
                span.set_attribute("message.index", index)
                span.set_attribute("message.value", raw_value)

                try:
                    payload = self._call_service_2(raw_value)
                    span.set_attribute("service_2.trace_id", payload["trace_id"])
                    self.sent_counter.add(1)
                    results.append(payload)
                    self.logger.info(
                        "sent value %s and received %s",
                        raw_value,
                        payload["doubled"],
                    )
                except ValueError as error:
                    self.failure_counter.add(1)
                    failures.append({"value": raw_value, "error": str(error)})
                    span.record_exception(error)
                    span.set_status(Status(StatusCode.ERROR, str(error)))
                    self.logger.exception("failed to send value %s", raw_value)
                finally:
                    self.latency_histogram.record((time.perf_counter() - start) * 1000)

        return {"results": results, "failures": failures}


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenTelemetry two-service sample")
    parser.add_argument(
        "--messages",
        nargs="*",
        default=DEFAULT_MESSAGES,
        help="Values sent from service_1 to service_2",
    )
    args = parser.parse_args()

    service_1 = Service1()
    service_1.telemetry = configure_telemetry("service_1")
    try:
        result = asyncio.run(service_1.send_numbers_to_service_2(args.messages))
        print(json.dumps(result, indent=2))
    finally:
        service_1.telemetry.force_flush()
        service_1.telemetry.shutdown()


if __name__ == "__main__":
    main()
