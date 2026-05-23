from __future__ import annotations


class JobQueue:
    def __init__(self) -> None:
        self._jobs: list[str] = []

    def enqueue(self, job: str) -> int:
        self._jobs.append(job)
        return len(self._jobs)

    def next(self) -> str | None:
        if not self._jobs:
            return None

        return self._jobs.pop(0)

    def clear(self) -> None:
        self._jobs = []

    @property
    def size(self) -> int:
        return len(self._jobs)
