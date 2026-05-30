from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Any, Optional

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    JSON,
    String,
    Text,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

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


class TagSchema(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None


class CategorySchema(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None


class PetSchema(BaseModel):
    id: Optional[int] = None
    name: str
    photoUrls: list[str]
    category: Optional[CategorySchema] = None
    tags: Optional[list[TagSchema]] = None
    status: Optional[str] = None


class OrderSchema(BaseModel):
    id: Optional[int] = None
    petId: Optional[int] = None
    quantity: Optional[int] = None
    shipDate: Optional[datetime] = None
    status: Optional[str] = None
    complete: Optional[bool] = None


class ApiResponseSchema(BaseModel):
    code: Optional[int] = None
    type: Optional[str] = None
    message: Optional[str] = None


# ── Database models ───────────────────────────────────────────────────────────


class Base(DeclarativeBase):
    pass


class PetRow(Base):
    __tablename__ = "pets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    photo_urls: Mapped[list] = mapped_column(JSON, default=list)
    category: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    @classmethod
    async def get(cls, session: AsyncSession, pet_id: int) -> Optional["PetRow"]:
        result = await session.execute(select(cls).where(cls.id == pet_id))
        return result.scalar_one_or_none()

    @classmethod
    async def create(cls, session: AsyncSession, pet: PetSchema) -> "PetRow":
        row = cls(
            name=pet.name,
            status=pet.status,
            photo_urls=pet.photoUrls,
            category=pet.category.model_dump() if pet.category else None,
            tags=[t.model_dump() for t in pet.tags] if pet.tags else None,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row

    @classmethod
    async def update(cls, session: AsyncSession, pet: PetSchema) -> Optional["PetRow"]:
        if pet.id is None:
            return None
        row = await cls.get(session, pet.id)
        if row is None:
            return None
        row.name = pet.name
        row.status = pet.status
        row.photo_urls = pet.photoUrls
        row.category = pet.category.model_dump() if pet.category else None
        row.tags = [t.model_dump() for t in pet.tags] if pet.tags else None
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
    async def find_by_status(cls, session: AsyncSession, status: str) -> list["PetRow"]:
        result = await session.execute(select(cls).where(cls.status == status))
        return list(result.scalars().all())

    @classmethod
    async def find_by_tags(
        cls, session: AsyncSession, tag_names: list[str]
    ) -> list["PetRow"]:
        result = await session.execute(select(cls))
        matched = []
        for pet in result.scalars().all():
            names = {t.get("name") for t in (pet.tags or [])}
            if set(tag_names).issubset(names):
                matched.append(pet)
        return matched

    @classmethod
    async def inventory(cls, session: AsyncSession) -> dict[str, int]:
        rows = await session.execute(
            select(cls.status, func.count(cls.id)).group_by(cls.status)
        )
        return {row[0]: row[1] for row in rows.all() if row[0] is not None}


class OrderRow(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pet_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ship_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    complete: Mapped[bool] = mapped_column(Boolean, default=False)

    @classmethod
    async def get(cls, session: AsyncSession, order_id: int) -> Optional["OrderRow"]:
        result = await session.execute(select(cls).where(cls.id == order_id))
        return result.scalar_one_or_none()

    @classmethod
    async def create(cls, session: AsyncSession, order: OrderSchema) -> "OrderRow":
        row = cls(
            pet_id=order.petId,
            quantity=order.quantity,
            ship_date=order.shipDate,
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


# ── Database setup ────────────────────────────────────────────────────────────

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(lambda x: Base.metadata.create_all(bind=x))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


# ── CRUD helpers ──────────────────────────────────────────────────────────────


def _pet_to_schema(row: PetRow) -> PetSchema:
    return PetSchema(
        id=row.id,
        name=row.name,
        photoUrls=row.photo_urls or [],
        category=CategorySchema(**row.category) if row.category else None,
        tags=[TagSchema(**t) for t in row.tags] if row.tags else None,
        status=row.status,
    )


def _order_to_schema(row: OrderRow) -> OrderSchema:
    return OrderSchema(
        id=row.id,
        petId=row.pet_id,
        quantity=row.quantity,
        shipDate=row.ship_date,
        status=row.status,
        complete=row.complete,
    )


def _sort_items(items: list[Any], sort_by: str, sort_order: str) -> list[Any]:
    reverse = sort_order == "desc"
    return sorted(
        items, key=lambda item: getattr(item, sort_by, None) or "", reverse=reverse
    )


def _pet_matches_search(row: PetRow, criteria: dict[str, Any]) -> bool:
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
        names = {t.get("name") for t in (row.tags or [])}
        if not set(tags).issubset(names):
            return False

    return True


def _order_matches_search(row: OrderRow, criteria: dict[str, Any]) -> bool:
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


@app.post("/pet", response_model=PetSchema, dependencies=[Depends(require_api_key)])
async def add_pet(
    pet: PetSchema,
    session: AsyncSession = Depends(get_session),
) -> PetSchema:
    return _pet_to_schema(await PetRow.create(session, pet))


@app.put("/pet", response_model=PetSchema, dependencies=[Depends(require_api_key)])
async def update_pet(
    pet: PetSchema,
    session: AsyncSession = Depends(get_session),
) -> PetSchema:
    if pet.id is None:
        raise HTTPException(status_code=400, detail="Pet ID required for update")
    row = await PetRow.update(session, pet)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return _pet_to_schema(row)


@app.get(
    "/pet/findByStatus",
    response_model=list[PetSchema],
    dependencies=[Depends(require_api_key)],
)
async def find_pets_by_status(
    status: PetStatus = Query(PetStatus.available),
    session: AsyncSession = Depends(get_session),
) -> list[PetSchema]:
    rows = await PetRow.find_by_status(session, status.value)
    return [_pet_to_schema(r) for r in rows]


@app.get(
    "/pet/findByTags",
    response_model=list[PetSchema],
    dependencies=[Depends(require_api_key)],
)
async def find_pets_by_tags(
    tags: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_session),
) -> list[PetSchema]:
    rows = await PetRow.find_by_tags(session, tags)
    return [_pet_to_schema(r) for r in rows]


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
    result = await session.execute(select(PetRow))
    rows = [row for row in result.scalars().all() if _pet_matches_search(row, criteria)]
    sort_field = str(criteria.get("sortBy") or "name")
    sort_field = {"name": "name", "status": "status"}.get(sort_field, "name")
    rows = _sort_items(rows, sort_field, str(criteria.get("sortOrder") or "asc"))
    total = len(rows)
    page = rows[offset : offset + limit]
    return {
        "results": [_pet_to_schema(row).model_dump(mode="json") for row in page],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": offset + limit < total,
    }


@app.get(
    "/pet/{petId}", response_model=PetSchema, dependencies=[Depends(require_api_key)]
)
async def get_pet_by_id(
    petId: int,
    session: AsyncSession = Depends(get_session),
) -> PetSchema:
    row = await PetRow.get(session, petId)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return _pet_to_schema(row)


@app.post("/pet/{petId}", status_code=200, dependencies=[Depends(require_api_key)])
async def update_pet_with_form(
    petId: int,
    name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await PetRow.get(session, petId)
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
    if not await PetRow.delete(session, petId):
        raise HTTPException(status_code=404, detail="Pet not found")
    return {}


@app.post(
    "/pet/{petId}/uploadImage",
    response_model=ApiResponseSchema,
    dependencies=[Depends(require_api_key)],
)
async def upload_pet_image(
    petId: int,
    request: Request,
    additionalMetadata: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
) -> ApiResponseSchema:
    if await PetRow.get(session, petId) is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    data = await request.body()
    return ApiResponseSchema(
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
    return await PetRow.inventory(session)


@app.post(
    "/store/order", response_model=OrderSchema, dependencies=[Depends(require_api_key)]
)
async def place_order(
    order: OrderSchema,
    session: AsyncSession = Depends(get_session),
) -> OrderSchema:
    return _order_to_schema(await OrderRow.create(session, order))


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
    result = await session.execute(select(OrderRow))
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
        "orders": [_order_to_schema(row).model_dump(mode="json") for row in page_rows],
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "totalPages": total_pages,
            "totalResults": total,
        },
    }


@app.get(
    "/store/order/{orderId}",
    response_model=OrderSchema,
    dependencies=[Depends(require_api_key)],
)
async def get_order_by_id(
    orderId: int,
    session: AsyncSession = Depends(get_session),
) -> OrderSchema:
    row = await OrderRow.get(session, orderId)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_schema(row)


@app.delete(
    "/store/order/{orderId}", status_code=200, dependencies=[Depends(require_api_key)]
)
async def delete_order(
    orderId: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not await OrderRow.delete(session, orderId):
        raise HTTPException(status_code=404, detail="Order not found")
    return {}


if __name__ == "__main__":
    uvicorn.run("openapi.app:app", host="0.0.0.0", port=8000, reload=False)
