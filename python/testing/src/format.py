from __future__ import annotations

from dataclasses import dataclass


@dataclass
class UserCard:
    name: str
    role: str
    active: bool


def format_user_card(user: UserCard) -> str:
    status = "active" if user.active else "inactive"
    return "\n".join([f"Name: {user.name}", f"Role: {user.role}", f"Status: {status}"])
