from __future__ import annotations

import os
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union, cast

import uvicorn
from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
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

from openapi.generated.server.apis.default_api_base import BaseDefaultApi
from openapi.generated.server.main import app
from openapi.generated.server.models.api_response import (
    ApiResponse as GeneratedApiResponse,
)
from openapi.generated.server.models.order import Order as GeneratedOrder
from openapi.generated.server.models.pet import Pet as GeneratedPet

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


app.router.lifespan_context = lifespan

# ── Pet routes ────────────────────────────────────────────────────────────────
# Specific paths are registered before parameterised ones to avoid shadowing.


async def add_pet(
    pet: Pet,
    session: AsyncSession = Depends(get_session),
) -> Pet:
    return await Pet.create(session, pet)


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


async def find_pets_by_status(
    status: PetStatus = Query(PetStatus.available),
    session: AsyncSession = Depends(get_session),
) -> list[Pet]:
    rows = await Pet.find_by_status(session, status.value)
    return rows


async def find_pets_by_tags(
    tags: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_session),
) -> list[Pet]:
    rows = await Pet.find_by_tags(session, tags)
    return rows


async def search_pets(
    criteria: dict[str, Any] = Body(...),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
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


async def get_pet_by_id(
    petId: int,
    session: AsyncSession = Depends(get_session),
) -> Pet:
    row = await Pet.get(session, petId)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return row


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


async def delete_pet(
    petId: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not await Pet.delete(session, petId):
        raise HTTPException(status_code=404, detail="Pet not found")
    return {}


async def upload_pet_image(
    petId: int,
    data: bytes = Body(default=b"", media_type="application/octet-stream"),
    additionalMetadata: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
) -> ApiResponse:
    if await Pet.get(session, petId) is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return ApiResponse(
        code=200,
        type="unknown",
        message=f"Uploaded {len(data)} bytes for pet {petId}; metadata={additionalMetadata}",
    )


# ── Store routes ──────────────────────────────────────────────────────────────


async def get_inventory(session: AsyncSession = Depends(get_session)) -> dict[str, int]:
    return await Pet.inventory(session)


async def place_order(
    order: Order,
    session: AsyncSession = Depends(get_session),
) -> Order:
    return await Order.create(session, order)


async def search_orders(
    criteria: dict[str, Any] = Body(...),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
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


async def get_order_by_id(
    orderId: int,
    session: AsyncSession = Depends(get_session),
) -> Order:
    row = await Order.get(session, orderId)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return row


async def delete_order(
    orderId: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not await Order.delete(session, orderId):
        raise HTTPException(status_code=404, detail="Order not found")
    return {}


@asynccontextmanager
async def _session_scope() -> AsyncIterator[AsyncSession]:
    dependency = app.dependency_overrides.get(get_session, get_session)
    session_generator = dependency()
    try:
        session = await anext(session_generator)
    except StopAsyncIteration as error:
        raise RuntimeError(
            "Session dependency did not yield a database session"
        ) from error
    try:
        yield session
    finally:
        await session_generator.aclose()


def _generated_pet(pet: Pet) -> GeneratedPet:
    return GeneratedPet.model_validate(pet.model_dump(by_alias=True))


def _generated_order(order: Order) -> GeneratedOrder:
    return GeneratedOrder.model_validate(order.model_dump(by_alias=True))


class PetstoreApi(BaseDefaultApi):
    async def add_pet_pet_post(self, pet: GeneratedPet) -> GeneratedPet:
        async with _session_scope() as session:
            result = await add_pet(
                Pet.model_validate(pet.model_dump(exclude_unset=True)),
                session=session,
            )
        return _generated_pet(result)

    async def update_pet_pet_put(self, pet: GeneratedPet) -> GeneratedPet:
        async with _session_scope() as session:
            result = await update_pet(
                Pet.model_validate(pet.model_dump(exclude_unset=True)),
                session=session,
            )
        return _generated_pet(result)

    async def find_pets_by_status_pet_find_by_status_get(
        self, status: Optional[Any]
    ) -> List[GeneratedPet]:
        query_status = PetStatus(status or PetStatus.available.value)
        async with _session_scope() as session:
            results = await find_pets_by_status(query_status, session=session)
        return [_generated_pet(pet) for pet in results]

    async def find_pets_by_tags_pet_find_by_tags_get(
        self, tags: Optional[List[Optional[str]]]
    ) -> List[GeneratedPet]:
        tag_names = [tag for tag in tags or [] if tag is not None]
        async with _session_scope() as session:
            results = await find_pets_by_tags(tag_names, session=session)
        return [_generated_pet(pet) for pet in results]

    async def search_pets_pet_search_post(
        self, request_body: Dict[str, Any], limit: Optional[int], offset: Optional[int]
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await search_pets(
                request_body,
                limit=limit if limit is not None else 20,
                offset=offset if offset is not None else 0,
                session=session,
            )

    async def get_pet_by_id_pet_pet_id_get(self, petId: int) -> GeneratedPet:
        async with _session_scope() as session:
            result = await get_pet_by_id(petId, session=session)
        return _generated_pet(result)

    async def update_pet_with_form_pet_pet_id_post(
        self, petId: int, name: Optional[str], status: Optional[str]
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await update_pet_with_form(
                petId,
                name=name,
                status=status,
                session=session,
            )

    async def delete_pet_pet_pet_id_delete(self, petId: int) -> Dict[str, object]:
        async with _session_scope() as session:
            return await delete_pet(petId, session=session)

    async def upload_pet_image_pet_pet_id_upload_image_post(
        self,
        petId: int,
        additional_metadata: Optional[str],
        body: Optional[Union[bytes, str, Tuple[str, bytes]]],
    ) -> GeneratedApiResponse:
        if isinstance(body, bytes):
            data = body
        elif isinstance(body, str):
            data = body.encode()
        elif body is None:
            data = b""
        else:
            data = body[1]
        async with _session_scope() as session:
            result = await upload_pet_image(
                petId,
                data=data,
                additionalMetadata=additional_metadata,
                session=session,
            )
        return GeneratedApiResponse.model_validate(result.model_dump())

    async def get_inventory_store_inventory_get(self) -> Dict[str, int]:
        async with _session_scope() as session:
            return await get_inventory(session=session)

    async def place_order_store_order_post(
        self, order: GeneratedOrder
    ) -> GeneratedOrder:
        async with _session_scope() as session:
            result = await place_order(
                Order.model_validate(order.model_dump(exclude_unset=True)),
                session=session,
            )
        return _generated_order(result)

    async def search_orders_store_order_search_post(
        self,
        request_body: Dict[str, Any],
        page: Optional[int],
        page_size: Optional[int],
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await search_orders(
                request_body,
                page=page if page is not None else 1,
                pageSize=page_size if page_size is not None else 20,
                session=session,
            )

    async def get_order_by_id_store_order_order_id_get(
        self, orderId: int
    ) -> GeneratedOrder:
        async with _session_scope() as session:
            result = await get_order_by_id(orderId, session=session)
        return _generated_order(result)

    async def delete_order_store_order_order_id_delete(
        self, orderId: int
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await delete_order(orderId, session=session)


@app.middleware("http")
async def enforce_api_key(request: Request, call_next):
    path = request.url.path
    if (
        path == "/pet"
        or path.startswith("/pet/")
        or path == "/store"
        or path.startswith("/store/")
    ) and request.headers.get("api_key") != API_KEY:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)


@app.api_route("/pet/search", methods=["QUERY"], include_in_schema=False)
async def search_pets_query(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Dict[str, object]:
    criteria = await request.json()
    async with _session_scope() as session:
        return await search_pets(criteria, limit=limit, offset=offset, session=session)


@app.api_route("/store/order/search", methods=["QUERY"], include_in_schema=False)
async def search_orders_query(
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
) -> Dict[str, object]:
    criteria = await request.json()
    async with _session_scope() as session:
        return await search_orders(
            criteria,
            page=page,
            pageSize=pageSize,
            session=session,
        )


if __name__ == "__main__":
    uvicorn.run("openapi.server:app", host="0.0.0.0", port=8000, reload=False)
