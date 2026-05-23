from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

SleepFn = Callable[[int], Awaitable[None]]


async def _sleep(delay_ms: int) -> None:
    await asyncio.sleep(delay_ms / 1000)


async def wait_for_label(
    label: str,
    delay_ms: int,
    sleep: SleepFn = _sleep,
) -> str:
    await sleep(delay_ms)
    return f"{label} ready"
