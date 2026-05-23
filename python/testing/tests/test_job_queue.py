from __future__ import annotations

from collections.abc import Generator

import pytest

from testing.src.job_queue import JobQueue


@pytest.fixture
def queue() -> Generator[JobQueue, None, None]:
    job_queue = JobQueue()
    yield job_queue
    job_queue.clear()


def test_tracks_size_as_jobs_are_added_and_removed(queue: JobQueue) -> None:
    assert queue.size == 0
    assert queue.enqueue("build") == 1
    assert queue.enqueue("test") == 2
    assert queue.next() == "build"
    assert queue.size == 1


def test_returns_none_when_empty(queue: JobQueue) -> None:
    assert queue.next() is None
