from __future__ import annotations

import importlib.util
import sys
from multiprocessing import shared_memory
from pathlib import Path
from typing import Any

import pytest

PARALLELISM_DIR = Path(__file__).resolve().parent
if str(PARALLELISM_DIR) not in sys.path:
    sys.path.insert(0, str(PARALLELISM_DIR))


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


queue_module: Any = load_module(
    "parallelism_queue_test", PARALLELISM_DIR / "queue_worker.py"
)
shared_memory_module: Any = load_module(
    "parallelism_shared_memory_test", PARALLELISM_DIR / "shared_memory_worker.py"
)


class FakeQueue:
    def __init__(self, items: list[int]) -> None:
        self.items = items
        self.results: list[int] = []
        self.task_done_calls = 0

    def get(self, timeout: int) -> int:
        if self.items:
            return self.items.pop(0)
        raise Exception("empty")

    def put(self, value: int) -> None:
        self.results.append(value)

    def task_done(self) -> None:
        self.task_done_calls += 1


def test_queue_worker_doubles_items(monkeypatch: pytest.MonkeyPatch) -> None:
    input_queue = FakeQueue([1, 3, 5])
    output_queue = FakeQueue([])

    monkeypatch.setattr(queue_module.time, "sleep", lambda seconds: None)

    queue_module.worker(input_queue, output_queue)

    assert output_queue.results == [2, 6, 10]
    assert input_queue.task_done_calls == 3


def test_shared_memory_worker_doubles_bytes(monkeypatch: pytest.MonkeyPatch) -> None:
    shm = shared_memory.SharedMemory(create=True, size=4)
    try:
        buf = shm.buf
        assert buf is not None

        for index, value in enumerate([1, 2, 3, 4]):
            buf[index] = value

        monkeypatch.setattr(shared_memory_module.time, "sleep", lambda seconds: None)

        shared_memory_module.worker(0, 4, shm.name)

        assert list(buf[:4]) == [2, 4, 6, 8]
    finally:
        shm.close()
        shm.unlink()
