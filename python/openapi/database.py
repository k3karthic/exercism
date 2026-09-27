from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any, Optional, cast

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    String,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/petstore",
)


class Base(DeclarativeBase):
    pass


class Pet(Base):
    __tablename__ = "pet"

    id: Mapped[int | None] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    photo_urls: Mapped[Any] = mapped_column(
        "photo_urls", JSON, nullable=False, default=list
    )
    category: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    status: Mapped[str | None] = mapped_column(nullable=True)

    @classmethod
    async def get(cls, session: AsyncSession, pet_id: int) -> Optional[Pet]:
        table = cast(Any, cls).__table__
        result = await session.execute(select(cls).where(table.c.id == pet_id))
        return result.scalar_one_or_none()

    @classmethod
    async def delete(cls, session: AsyncSession, pet_id: int) -> bool:
        row = await cls.get(session, pet_id)
        if row is None:
            return False
        await session.delete(row)
        await session.commit()
        return True

    @classmethod
    async def find_by_status(cls, session: AsyncSession, status: str) -> list[Pet]:
        table = cast(Any, cls).__table__
        result = await session.execute(select(cls).where(table.c.status == status))
        return list(result.scalars().all())

    @classmethod
    async def find_by_tags(
        cls, session: AsyncSession, tag_names: list[str]
    ) -> list[Pet]:
        result = await session.execute(select(cls))
        return [
            pet
            for pet in result.scalars().all()
            if set(tag_names).issubset(
                {
                    tag["name"]
                    for tag in pet.tags or []
                    if isinstance(tag, dict) and isinstance(tag.get("name"), str)
                }
            )
        ]

    @classmethod
    async def inventory(cls, session: AsyncSession) -> dict[str, int]:
        table = cast(Any, cls).__table__
        rows = await session.execute(
            select(table.c.status, func.count(table.c.id)).group_by(table.c.status)
        )
        return {row[0]: row[1] for row in rows.all() if row[0] is not None}


class Order(Base):
    __tablename__ = "order"

    id: Mapped[int | None] = mapped_column(primary_key=True)
    pet_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ship_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    @classmethod
    async def get(cls, session: AsyncSession, order_id: int) -> Optional[Order]:
        table = cast(Any, cls).__table__
        result = await session.execute(select(cls).where(table.c.id == order_id))
        return result.scalar_one_or_none()

    @classmethod
    async def delete(cls, session: AsyncSession, order_id: int) -> bool:
        row = await cls.get(session, order_id)
        if row is None:
            return False
        await session.delete(row)
        await session.commit()
        return True


engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
