from __future__ import annotations

import pytest

from testing.src import delivery
from testing.src.format import UserCard


def test_uses_the_mocked_formatter_and_the_real_math_helper(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(delivery, "format_user_card", lambda user: "MOCKED CARD")

    summary = delivery.build_delivery_summary(
        delivery.Delivery(
            recipient=UserCard(
                name="Ada",
                role="engineer",
                active=True,
            ),
            ratings=[3, 4, 5],
        )
    )

    assert summary == "MOCKED CARD\nAverage rating: 4.0"
