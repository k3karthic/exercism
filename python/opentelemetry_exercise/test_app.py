from __future__ import annotations

from collections.abc import AsyncGenerator

import httpx
import pytest
from httpx import ASGITransport
from fastapi import FastAPI

from opentelemetry_exercise.app import (
    DEFAULT_MESSAGES,
    WorkflowResult,
    Service1,
    Service2,
)


@pytest.fixture
def service_2_app() -> FastAPI:
    return Service2().app


@pytest.fixture
def service_1_app(service_2_app: FastAPI) -> FastAPI:
    async def dependency() -> AsyncGenerator[httpx.AsyncClient, None]:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=service_2_app),
            base_url="http://service-2",
        ) as client:
            yield client

    return Service1(service_2_dependency=dependency).app


@pytest.mark.asyncio
async def test_service_1_calls_service_2_over_http(service_1_app) -> None:
    async with httpx.AsyncClient(
        transport=ASGITransport(app=service_1_app),
        base_url="http://service-1",
    ) as client:
        response = await client.post("/run")

    assert response.status_code == 200
    payload = WorkflowResult.model_validate(response.json())
    assert [item.doubled for item in payload.results] == [2, 4, 6, 8]
    assert [failure.value for failure in payload.failures] == ["oops"]
    trace_ids = {item.trace_id for item in payload.results}
    assert len(trace_ids) == 1
    assert payload.results
    assert payload.results[0].value in DEFAULT_MESSAGES


@pytest.mark.asyncio
async def test_service_2_rejects_invalid_number(service_2_app) -> None:
    async with httpx.AsyncClient(
        transport=ASGITransport(app=service_2_app),
        base_url="http://service-2",
    ) as client:
        response = await client.post("/double", json={"value": "oops"})

    assert response.status_code == 400
    assert response.json()["detail"] == "value must be numeric"
