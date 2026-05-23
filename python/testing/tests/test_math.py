from __future__ import annotations

import pytest

from testing.src.math import average, clamp, sum


def test_clamps_values_into_the_requested_range() -> None:
    assert clamp(14, 0, 10) == 10
    assert clamp(-2, 0, 10) == 0
    assert clamp(5, 0, 10) == 5


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ([1, 2, 3], 6),
        ([10, -4, 2], 8),
        ([], 0),
    ],
)
def test_sums_values(values: list[float], expected: float) -> None:
    assert sum(values) == expected


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ([2, 4, 6], 4),
        ([5], 5),
        ([], 0),
    ],
)
def test_averages_values(values: list[float], expected: float) -> None:
    assert average(values) == expected
