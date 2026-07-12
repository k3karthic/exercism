"""Tests for the gRPC doubler example."""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from collections.abc import Coroutine
from typing import Any

import pytest

GRPC_DIR = Path(__file__).resolve().parent
if str(GRPC_DIR) not in sys.path:
    sys.path.insert(0, str(GRPC_DIR))

import client  # noqa: E402
import doubler_service_pb2 as pb2  # noqa: E402
import server  # noqa: E402


class DummyChannel:
    def __enter__(self) -> DummyChannel:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


@pytest.mark.asyncio
async def test_double_caches_request_results() -> None:
    service = server.DoublerService()

    first = pb2.DoubleRequest(request_id="abc123", number=21)
    second = pb2.DoubleRequest(request_id="abc123", number=99)

    first_response = await service.Double(first, None)
    second_response = await service.Double(second, None)

    assert first_response.result == 42
    assert second_response.result == 42
    assert len(service._processed_requests) == 1


@pytest.mark.asyncio
async def test_cleanup_expired_requests_removes_old_entries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = server.DoublerService()
    service._processed_requests = {
        "expired": (2, 0.0),
        "fresh": (4, 95.0),
    }
    monkeypatch.setattr(server.time, "time", lambda: 100.0)

    stop_event = asyncio.Event()

    calls = 0

    async def fake_wait_for(awaitable: Coroutine[Any, Any, bool], timeout: int) -> bool:
        nonlocal calls
        calls += 1
        if calls == 1:
            awaitable.close()
            raise asyncio.TimeoutError

        stop_event.set()
        return await awaitable

    monkeypatch.setattr(server.asyncio, "wait_for", fake_wait_for)

    cleanup_task = asyncio.create_task(
        service.cleanup_expired_requests(stop_event, ttl_seconds=10, interval_seconds=1)
    )

    await cleanup_task

    assert "expired" not in service._processed_requests
    assert "fresh" in service._processed_requests


def test_send_request_with_retry_rejects_mismatched_request_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Stub:
        def __init__(self) -> None:
            self.calls = 0

        def Double(self, request: pb2.DoubleRequest) -> pb2.DoubleResponse:
            self.calls += 1
            return pb2.DoubleResponse(request_id="wrong-id", result=request.number * 2)

    stub = Stub()
    monkeypatch.setattr(
        client.grpc, "insecure_channel", lambda target, options=(): DummyChannel()
    )
    monkeypatch.setattr(client.pb2_grpc, "DoublerStub", lambda channel: stub)

    with pytest.raises(ValueError, match="Request ID mismatch"):
        client.send_request_with_retry(
            target="localhost:50051",
            number=7,
            req_id="req-2",
        )

    assert stub.calls == 1
