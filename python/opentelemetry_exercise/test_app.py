from __future__ import annotations

import pytest
from opentelemetry.sdk.trace import TracerProvider

from opentelemetry_exercise.app import (
    DEFAULT_MESSAGES,
    Service1,
    Service2,
    TelemetryBundle,
)


@pytest.fixture
def services() -> tuple[Service1, Service2]:
    service_2 = Service2()
    service_1 = Service1(service_2)
    service_1.telemetry = TelemetryBundle(tracer_provider=TracerProvider())
    service_2.telemetry = TelemetryBundle(tracer_provider=TracerProvider())
    service_1.tracer  # Initialize the tracer after installing the test provider.
    service_2.tracer
    return service_1, service_2


@pytest.mark.asyncio
async def test_service_1_calls_service_2_directly(
    services: tuple[Service1, Service2],
) -> None:
    service_1, _ = services

    payload = await service_1.send_numbers_to_service_2()

    assert [item["doubled"] for item in payload["results"]] == [2, 4, 6, 8]
    assert [failure["value"] for failure in payload["failures"]] == ["oops"]
    trace_ids = {item["trace_id"] for item in payload["results"]}
    assert len(trace_ids) == len(payload["results"])
    assert payload["results"]
    assert payload["results"][0]["value"] in DEFAULT_MESSAGES


@pytest.mark.asyncio
async def test_service_2_rejects_invalid_number() -> None:
    service_2 = Service2()

    with pytest.raises(ValueError, match="value must be numeric"):
        await service_2.double_number("oops")
