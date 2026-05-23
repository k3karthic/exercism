from __future__ import annotations

from testing.src.format import UserCard
from testing.src.format import format_user_card


def test_matches_the_expected_output() -> None:
    assert (
        format_user_card(
            UserCard(
                name="Grace",
                role="maintainer",
                active=False,
            )
        )
        == """Name: Grace
Role: maintainer
Status: inactive"""
    )
