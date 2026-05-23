from __future__ import annotations

import asyncio

from testing.src.wait import wait_for_label


def test_resolves_after_the_requested_delay() -> None:
    captured_delays: list[int] = []

    async def fake_sleep(delay_ms: int) -> None:
        captured_delays.append(delay_ms)

    result = asyncio.run(wait_for_label("upload", 250, sleep=fake_sleep))

    assert captured_delays == [250]
    assert result == "upload ready"
