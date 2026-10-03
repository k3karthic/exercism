from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openapi.database import Order, Pet
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.order import Order as OrderSchema
from openapi.generated.server.models.pet import Pet as PetSchema


def _pet_schema(row: Pet) -> PetSchema:
    return PetSchema.model_validate(
        {
            "id": row.id,
            "name": row.name,
            "photoUrls": row.photo_urls,
            "category": row.category,
            "tags": row.tags,
            "status": row.status,
        }
    )


def _order_schema(row: Order) -> OrderSchema:
    return OrderSchema.model_validate(
        {
            "id": row.id,
            "pet_id": row.pet_id,
            "quantity": row.quantity,
            "ship_date": row.ship_date.isoformat()
            if row.ship_date is not None
            else None,
            "status": row.status,
            "complete": row.complete,
        }
    )


def _sort_items(items: list[Any], sort_by: str, sort_order: str) -> list[Any]:
    return sorted(
        items,
        key=lambda item: getattr(item, sort_by, None) or "",
        reverse=sort_order == "desc",
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
    tag_names = {
        tag["name"]
        for tag in row.tags or []
        if isinstance(tag, dict) and isinstance(tag.get("name"), str)
    }
    if tags and not set(tags).issubset(tag_names):
        return False

    return True


def _order_matches_date_range(row: Order, date_range: dict[str, Any]) -> bool:
    if not date_range:
        return True
    if row.ship_date is None:
        return False

    start = date_range.get("from")
    if start is not None and row.ship_date < _parse_datetime(start):
        return False

    end = date_range.get("to")
    if end is not None and row.ship_date > _parse_datetime(end):
        return False

    return True


def _order_matches_quantity_range(
    row: Order, quantity_range: dict[str, Any]
) -> bool:
    quantity = row.quantity or 0
    minimum = quantity_range.get("min")
    if minimum is not None and quantity < minimum:
        return False

    maximum = quantity_range.get("max")
    if maximum is not None and quantity > maximum:
        return False

    return True


def _order_matches_search(  # noqa: PLR0911
    row: Order, criteria: dict[str, Any]
) -> bool:
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

    if not _order_matches_date_range(row, criteria.get("dateRange") or {}):
        return False
    if not _order_matches_quantity_range(
        row, criteria.get("quantityRange") or {}
    ):
        return False

    return True


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


async def add_pet(session: AsyncSession, pet: PetSchema) -> PetSchema:
    row = Pet(
        id=int(pet.id) if pet.id is not None else None,
        name=pet.name,
        status=pet.status,
        photo_urls=pet.photo_urls or [],
        category=pet.category.model_dump(mode="json", exclude_none=True)
        if pet.category is not None
        else None,
        tags=[tag.model_dump(mode="json", exclude_none=True) for tag in pet.tags or []],
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _pet_schema(row)


async def update_pet(session: AsyncSession, pet: PetSchema) -> PetSchema:
    if pet.id is None:
        raise HTTPException(status_code=400, detail="Pet ID required for update")
    row = await Pet.get(session, int(pet.id))
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    row.name = pet.name
    row.status = pet.status
    row.photo_urls = pet.photo_urls or []
    row.category = (
        pet.category.model_dump(mode="json", exclude_none=True)
        if pet.category is not None
        else None
    )
    row.tags = [
        tag.model_dump(mode="json", exclude_none=True) for tag in pet.tags or []
    ]
    await session.commit()
    await session.refresh(row)
    return _pet_schema(row)


async def find_pets_by_status(session: AsyncSession, status: str) -> list[PetSchema]:
    rows = await Pet.find_by_status(session, status)
    return [_pet_schema(row) for row in rows]


async def find_pets_by_tags(session: AsyncSession, tags: list[str]) -> list[PetSchema]:
    rows = await Pet.find_by_tags(session, tags)
    return [_pet_schema(row) for row in rows]


async def search_pets(
    session: AsyncSession,
    criteria: dict[str, Any],
    limit: int,
    offset: int,
) -> dict[str, Any]:
    result = await session.execute(select(Pet))
    rows = [row for row in result.scalars().all() if _pet_matches_search(row, criteria)]
    sort_field = str(criteria.get("sortBy") or "name")
    sort_field = {"name": "name", "status": "status"}.get(sort_field, "name")
    rows = _sort_items(rows, sort_field, str(criteria.get("sortOrder") or "asc"))
    total = len(rows)
    page = rows[offset : offset + limit]
    return {
        "results": [
            _pet_schema(row).model_dump(mode="json", by_alias=True) for row in page
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": offset + limit < total,
    }


async def get_pet_by_id(session: AsyncSession, pet_id: int) -> PetSchema:
    row = await Pet.get(session, pet_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return _pet_schema(row)


async def update_pet_with_form(
    session: AsyncSession, pet_id: int, name: str | None, status: str | None
) -> dict[str, object]:
    row = await Pet.get(session, pet_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    if name is not None:
        row.name = name
    if status is not None:
        row.status = status
    await session.commit()
    return {}


async def delete_pet(session: AsyncSession, pet_id: int) -> dict[str, object]:
    if not await Pet.delete(session, pet_id):
        raise HTTPException(status_code=404, detail="Pet not found")
    return {}


async def upload_pet_image(
    session: AsyncSession,
    pet_id: int,
    data: bytes,
    additional_metadata: str | None,
) -> ApiResponse:
    if await Pet.get(session, pet_id) is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return ApiResponse(
        code=200,
        type="unknown",
        message=(
            f"Uploaded {len(data)} bytes for pet {pet_id}; "
            f"metadata={additional_metadata}"
        ),
    )


async def get_inventory(session: AsyncSession) -> dict[str, int]:
    return await Pet.inventory(session)


async def place_order(session: AsyncSession, order: OrderSchema) -> OrderSchema:
    row = Order(
        id=int(order.id) if order.id is not None else None,
        pet_id=int(order.pet_id) if order.pet_id is not None else None,
        quantity=int(order.quantity) if order.quantity is not None else None,
        ship_date=_parse_datetime(order.ship_date)
        if order.ship_date is not None
        else datetime.now(UTC),
        status=order.status.value if order.status is not None else None,
        complete=order.complete or False,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _order_schema(row)


async def search_orders(
    session: AsyncSession,
    criteria: dict[str, Any],
    page: int,
    page_size: int,
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
    }.get(sort_field, "ship_date")
    rows = _sort_items(rows, sort_field, str(criteria.get("sortOrder") or "desc"))
    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "orders": [
            _order_schema(row).model_dump(mode="json", by_alias=True)
            for row in page_rows
        ],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "totalResults": total,
        },
    }


async def get_order_by_id(session: AsyncSession, order_id: int) -> OrderSchema:
    row = await Order.get(session, order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_schema(row)


async def delete_order(session: AsyncSession, order_id: int) -> dict[str, object]:
    if not await Order.delete(session, order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    return {}
