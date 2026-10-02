# pylint: disable=redefined-outer-name
from __future__ import annotations

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)

from opentelemetry_exercise.app import Service1
from opentelemetry_exercise.service_2_process import Service2
from opentelemetry_exercise.utils import (
    DEFAULT_MESSAGES,
    TelemetryBundle,
)


@pytest.fixture
def service_1() -> Service1:
    service_1 = Service1()
    service_1.telemetry = TelemetryBundle(tracer_provider=TracerProvider())
    return service_1


@pytest.mark.asyncio
async def test_service_1_calls_service_2_via_subprocess(
    service_1: Service1,
) -> None:
    payload = await service_1.send_numbers_to_service_2()

    assert [item["doubled"] for item in payload["results"]] == [2, 4, 6, 8]
    assert [failure["value"] for failure in payload["failures"]] == ["oops"]
    trace_ids = {item["trace_id"] for item in payload["results"]}
    assert len(trace_ids) == len(payload["results"])
    assert payload["results"]
    assert payload["results"][0]["value"] in DEFAULT_MESSAGES


@pytest.mark.asyncio
async def test_subprocess_span_nests_under_caller_trace(
    service_1: Service1,
) -> None:
    """The subprocess has no OTel SDK/propagator wired into its transport,
    so this proves the manually propagated (via `TRACEPARENT`/`TRACESTATE`
    env vars + `opentelemetry.propagate.inject`/`extract`) context still
    produces a child span sharing the parent's trace id."""
    exporter = InMemorySpanExporter()
    assert service_1.telemetry.tracer_provider is not None
    service_1.telemetry.tracer_provider.add_span_processor(
        SimpleSpanProcessor(exporter)
    )

    payload = await service_1.send_numbers_to_service_2(["3"])

    doubled_result = payload["results"][0]
    parent_spans = [
        span for span in exporter.get_finished_spans() if span.context is not None
    ]
    assert parent_spans, "expected service_1 to emit at least one span"
    span_context = parent_spans[0].context
    assert span_context is not None
    parent_trace_id = f"{span_context.trace_id:032x}"

    assert doubled_result["trace_id"] == parent_trace_id


@pytest.mark.asyncio
async def test_service_2_rejects_invalid_number() -> None:
    service_2 = Service2()

    with pytest.raises(ValueError, match="value must be numeric"):
        await service_2.double_number("oops")
