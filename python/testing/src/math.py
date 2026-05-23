from __future__ import annotations

from builtins import sum as builtin_sum
from collections.abc import Sequence


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def sum(values: Sequence[float]) -> float:  # noqa: A001
    return float(builtin_sum(values))


def average(values: Sequence[float]) -> float:
    if not values:
        return 0.0

    return sum(values) / len(values)
