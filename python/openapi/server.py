from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Any, Optional, cast

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.security import APIKeyHeader
from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    func,
    select,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import Field, SQLModel

# ── Config ────────────────────────────────────────────────────────────────────

API_KEY = "some-api-key"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://petstore:petstore@localhost:5432/petstore",
)

# ── Pydantic models ───────────────────────────────────────────────────────────


class PetStatus(str, Enum):
    available = "available"
    pending = "pending"
    sold = "sold"


class OrderStatus(str, Enum):
    placed = "placed"
    approved = "approved"
    delivered = "delivered"


class Tag(SQLModel):
    id: Optional[int] = None
    name: Optional[str] = None


class Category(SQLModel):
    id: Optional[int] = None
    name: Optional[str] = None


class Pet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    photo_urls: Any = Field(
        default_factory=list,
        alias="photoUrls",
        sa_column=Column(JSON, nullable=False),
    )
    category: Any = Field(default=None, sa_column=Column(JSON, nullable=True))
    tags: list[str] = Field(
        default_factory=list,
        sa_column=Column(postgresql.ARRAY(String()), nullable=False),
    )
    status: Optional[str] = None

    @classmethod
    async def get(cls, session: AsyncSession, pet_id: int) -> Optional["Pet"]:
        table = cast(Any, cls).__table__
        result = await session.execute(select(cls).where(table.c.id == pet_id))
        return result.scalar_one_or_none()

    @classmethod
    async def create(cls, session: AsyncSession, pet: "Pet") -> "Pet":
        row = cls(
            id=pet.id,
            name=pet.name,
            status=pet.status,
            photoUrls=pet.photo_urls,
            category=pet.category,
            tags=list(dict.fromkeys(pet.tags)),
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row

    @classmethod
    async def update(cls, session: AsyncSession, pet: "Pet") -> Optional["Pet"]:
        if pet.id is None:
            return None
        row = await cls.get(session, pet.id)
        if row is None:
            return None
        row.name = pet.name
        row.status = pet.status
        row.photo_urls = pet.photo_urls
        row.category = pet.category
        row.tags = list(dict.fromkeys(pet.tags))
        await session.commit()
        await session.refresh(row)
        return row

    @classmethod
    async def delete(cls, session: AsyncSession, pet_id: int) -> bool:
        row = await cls.get(session, pet_id)
        if row is None:
            return False
        await session.delete(row)
        await session.commit()
        return True

    @classmethod
    async def find_by_status(cls, session: AsyncSession, status: str) -> list["Pet"]:
        table = cast(Any, cls).__table__
        result = await session.execute(select(cls).where(table.c.status == status))
        return list(result.scalars().all())

    @classmethod
    async def find_by_tags(
        cls, session: AsyncSession, tag_names: list[str]
    ) -> list["Pet"]:
        result = await session.execute(select(cls))
        matched: list[Pet] = []
        for pet in result.scalars().all():
            if set(tag_names).issubset(set(pet.tags or [])):
                matched.append(pet)
        return matched

    @classmethod
    async def inventory(cls, session: AsyncSession) -> dict[str, int]:
        table = cast(Any, cls).__table__
        rows = await session.execute(
            select(table.c.status, func.count(table.c.id)).group_by(table.c.status)
        )
        return {row[0]: row[1] for row in rows.all() if row[0] is not None}


class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pet_id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, nullable=True)
    )
    quantity: Optional[int] = Field(
        default=None, sa_column=Column(Integer, nullable=True)
    )
    ship_date: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    status: Optional[str] = Field(
        default=None, sa_column=Column(String(20), nullable=True)
    )
    complete: bool = Field(default=False, sa_column=Column(Boolean, default=False))

    @classmethod
    async def get(cls, session: AsyncSession, order_id: int) -> Optional["Order"]:
        table = cast(Any, cls).__table__
        result = await session.execute(select(cls).where(table.c.id == order_id))
        return result.scalar_one_or_none()

    @classmethod
    async def create(cls, session: AsyncSession, order: "Order") -> "Order":
        row = cls(
            id=order.id,
            pet_id=order.pet_id,
            quantity=order.quantity,
            ship_date=order.ship_date,
            status=order.status,
            complete=order.complete or False,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row

    @classmethod
    async def delete(cls, session: AsyncSession, order_id: int) -> bool:
        row = await cls.get(session, order_id)
        if row is None:
            return False
        await session.delete(row)
        await session.commit()
        return True


class ApiResponse(SQLModel):
    code: Optional[int] = None
    type: Optional[str] = None
    message: Optional[str] = None


# ── Database setup ────────────────────────────────────────────────────────────

Base = SQLModel

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(lambda x: Base.metadata.create_all(bind=x))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


# ── CRUD helpers ──────────────────────────────────────────────────────────────


def _sort_items(items: list[Any], sort_by: str, sort_order: str) -> list[Any]:
    reverse = sort_order == "desc"
    return sorted(
        items, key=lambda item: getattr(item, sort_by, None) or "", reverse=reverse
    )


def _pet_matches_search(row: Pet, criteria: dict[str, Any]) -> bool:
    name = criteria.get("name")
    if name:
        needle = str(name).replace("*", "").lower()
        if needle and needle not in row.name.lower():
            return False

    statuses = criteria.get("status") or []
    if statuses and row.status not in statuses:
        return False

    tags = criteria.get("tags") or []
    if tags:
        if not set(tags).issubset(set(row.tags or [])):
            return False

    return True


def _order_matches_search(row: Order, criteria: dict[str, Any]) -> bool:
    order_id = criteria.get("orderId")
    if order_id is not None and row.id != order_id:
        return False

    pet_id = criteria.get("petId")
    if pet_id is not None and row.pet_id != pet_id:
        return False

    statuses = criteria.get("status") or []
    if statuses and row.status not in statuses:
        return False

    complete = criteria.get("complete")
    if complete is not None and row.complete != complete:
        return False

    date_range = criteria.get("dateRange") or {}
    if date_range and row.ship_date is None:
        return False
    if date_range.get("from") is not None and row.ship_date is not None:
        if row.ship_date < datetime.fromisoformat(
            date_range["from"].replace("Z", "+00:00")
        ):
            return False
    if date_range.get("to") is not None and row.ship_date is not None:
        if row.ship_date > datetime.fromisoformat(
            date_range["to"].replace("Z", "+00:00")
        ):
            return False

    quantity_range = criteria.get("quantityRange") or {}
    if (
        quantity_range.get("min") is not None
        and (row.quantity or 0) < quantity_range["min"]
    ):
        return False
    if (
        quantity_range.get("max") is not None
        and (row.quantity or 0) > quantity_range["max"]
    ):
        return False

    return True


# ── Security ──────────────────────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="api_key", auto_error=False)


async def require_api_key(key: Optional[str] = Depends(_api_key_header)) -> None:
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


# ── Application ───────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    await init_db()
    yield


app = FastAPI(title="Petstore", version="1.0.13", lifespan=lifespan)

# ── Pet routes ────────────────────────────────────────────────────────────────
# Specific paths are registered before parameterised ones to avoid shadowing.


@app.post("/pet", response_model=Pet, dependencies=[Depends(require_api_key)])
async def add_pet(
    pet: Pet,
    session: AsyncSession = Depends(get_session),
) -> Pet:
    return await Pet.create(session, pet)


@app.put("/pet", response_model=Pet, dependencies=[Depends(require_api_key)])
async def update_pet(
    pet: Pet,
    session: AsyncSession = Depends(get_session),
) -> Pet:
    if pet.id is None:
        raise HTTPException(status_code=400, detail="Pet ID required for update")
    row = await Pet.update(session, pet)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return row


@app.get(
    "/pet/findByStatus",
    response_model=list[Pet],
    dependencies=[Depends(require_api_key)],
)
async def find_pets_by_status(
    status: PetStatus = Query(PetStatus.available),
    session: AsyncSession = Depends(get_session),
) -> list[Pet]:
    rows = await Pet.find_by_status(session, status.value)
    return rows


@app.get(
    "/pet/findByTags",
    response_model=list[Pet],
    dependencies=[Depends(require_api_key)],
)
async def find_pets_by_tags(
    tags: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_session),
) -> list[Pet]:
    rows = await Pet.find_by_tags(session, tags)
    return rows


@app.api_route(
    "/pet/search", methods=["QUERY"], dependencies=[Depends(require_api_key)]
)
async def search_pets(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    criteria = await request.json()
    result = await session.execute(select(Pet))
    rows = [row for row in result.scalars().all() if _pet_matches_search(row, criteria)]
    sort_field = str(criteria.get("sortBy") or "name")
    sort_field = {"name": "name", "status": "status"}.get(sort_field, "name")
    rows = _sort_items(rows, sort_field, str(criteria.get("sortOrder") or "asc"))
    total = len(rows)
    page = rows[offset : offset + limit]
    return {
        "results": [row.model_dump(mode="json", by_alias=True) for row in page],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": offset + limit < total,
    }


@app.get("/pet/{petId}", response_model=Pet, dependencies=[Depends(require_api_key)])
async def get_pet_by_id(
    petId: int,
    session: AsyncSession = Depends(get_session),
) -> Pet:
    row = await Pet.get(session, petId)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return row


@app.post("/pet/{petId}", status_code=200, dependencies=[Depends(require_api_key)])
async def update_pet_with_form(
    petId: int,
    name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await Pet.get(session, petId)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    if name is not None:
        row.name = name
    if status is not None:
        row.status = status
    await session.commit()
    return {}


@app.delete("/pet/{petId}", status_code=200, dependencies=[Depends(require_api_key)])
async def delete_pet(
    petId: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not await Pet.delete(session, petId):
        raise HTTPException(status_code=404, detail="Pet not found")
    return {}


@app.post(
    "/pet/{petId}/uploadImage",
    response_model=ApiResponse,
    dependencies=[Depends(require_api_key)],
)
async def upload_pet_image(
    petId: int,
    request: Request,
    additionalMetadata: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
) -> ApiResponse:
    if await Pet.get(session, petId) is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    data = await request.body()
    return ApiResponse(
        code=200,
        type="unknown",
        message=f"Uploaded {len(data)} bytes for pet {petId}; metadata={additionalMetadata}",
    )


# ── Store routes ──────────────────────────────────────────────────────────────


@app.get(
    "/store/inventory",
    response_model=dict[str, int],
    dependencies=[Depends(require_api_key)],
)
async def get_inventory(session: AsyncSession = Depends(get_session)) -> dict[str, int]:
    return await Pet.inventory(session)


@app.post("/store/order", response_model=Order, dependencies=[Depends(require_api_key)])
async def place_order(
    order: Order,
    session: AsyncSession = Depends(get_session),
) -> Order:
    return await Order.create(session, order)


@app.api_route(
    "/store/order/search", methods=["QUERY"], dependencies=[Depends(require_api_key)]
)
async def search_orders(
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    criteria = await request.json()
    result = await session.execute(select(Order))
    rows = [
        row for row in result.scalars().all() if _order_matches_search(row, criteria)
    ]
    sort_field = str(criteria.get("sortBy") or "shipDate")
    sort_field = {
        "shipDate": "ship_date",
        "petId": "pet_id",
        "quantity": "quantity",
        "status": "status",
        "id": "id",
    }.get(
        sort_field,
        "ship_date",
    )
    rows = _sort_items(rows, sort_field, str(criteria.get("sortOrder") or "desc"))
    total = len(rows)
    start = (page - 1) * pageSize
    page_rows = rows[start : start + pageSize]
    total_pages = (total + pageSize - 1) // pageSize if total else 0
    return {
        "orders": [row.model_dump(mode="json", by_alias=True) for row in page_rows],
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "totalPages": total_pages,
            "totalResults": total,
        },
    }


@app.get(
    "/store/order/{orderId}",
    response_model=Order,
    dependencies=[Depends(require_api_key)],
)
async def get_order_by_id(
    orderId: int,
    session: AsyncSession = Depends(get_session),
) -> Order:
    row = await Order.get(session, orderId)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return row


@app.delete(
    "/store/order/{orderId}", status_code=200, dependencies=[Depends(require_api_key)]
)
async def delete_order(
    orderId: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not await Order.delete(session, orderId):
        raise HTTPException(status_code=404, detail="Order not found")
    return {}


if __name__ == "__main__":
    uvicorn.run("openapi.server:app", host="0.0.0.0", port=8000, reload=False)
