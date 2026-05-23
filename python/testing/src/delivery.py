from __future__ import annotations

from dataclasses import dataclass

from testing.src.format import UserCard, format_user_card
from testing.src.math import average


@dataclass
class Delivery:
    recipient: UserCard
    ratings: list[float]


def build_delivery_summary(delivery: Delivery) -> str:
    card = format_user_card(delivery.recipient)
    score = f"{average(delivery.ratings):.1f}"
    return f"{card}\nAverage rating: {score}"
