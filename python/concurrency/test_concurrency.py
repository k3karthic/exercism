from __future__ import annotations

import asyncio
import queue as std_queue
import sys
from collections.abc import Coroutine
from pathlib import Path
from typing import Any

import pytest

CONCURRENCY_DIR = Path(__file__).resolve().parent
if str(CONCURRENCY_DIR) not in sys.path:
    sys.path.insert(0, str(CONCURRENCY_DIR))

import _async as async_module  # noqa: E402
import _threads as threads_module  # noqa: E402


class FakeQueue:
    def __init__(self, items: list[int]) -> None:
        self.items = items
        self.results: list[int] = []
        self.task_done_calls = 0

    def get(self, timeout: int) -> int:
        if self.items:
            return self.items.pop(0)
        raise std_queue.Empty

    def put(self, value: int) -> None:
        self.results.append(value)

    def task_done(self) -> None:
        self.task_done_calls += 1


def test_threads_worker_doubles_items(monkeypatch: pytest.MonkeyPatch) -> None:
    input_queue = FakeQueue([2, 4])
    output_queue = FakeQueue([])

    monkeypatch.setattr(threads_module, "input_queue", input_queue)
    monkeypatch.setattr(threads_module, "output_queue", output_queue)
    monkeypatch.setattr(threads_module.time, "sleep", lambda seconds: None)

    threads_module.worker()

    assert output_queue.results == [4, 8]
    assert input_queue.task_done_calls == 2


@pytest.mark.asyncio
async def test_async_worker_doubles_items(monkeypatch: pytest.MonkeyPatch) -> None:
    input_queue: asyncio.Queue[int] = asyncio.Queue()
    output_queue: asyncio.Queue[int] = asyncio.Queue()
    await input_queue.put(3)
    await input_queue.put(7)

    async def fake_wait_for(awaitable: Coroutine[Any, Any, int], timeout: int) -> int:
        if input_queue.empty():
            awaitable.close()
            raise asyncio.TimeoutError
        return await awaitable

    async def fake_sleep(seconds: float) -> None:
        return None

    monkeypatch.setattr(async_module.asyncio, "wait_for", fake_wait_for)
    monkeypatch.setattr(async_module.asyncio, "sleep", fake_sleep)

    await async_module.worker(input_queue, output_queue, worker_id=1)

    results: list[int] = []
    while not output_queue.empty():
        results.append(await output_queue.get())

    assert results == [6, 14]
