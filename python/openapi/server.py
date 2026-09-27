from __future__ import annotations

from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Optional, Tuple, Union

import uvicorn
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from openapi.database import get_session, init_db
from openapi.generated.server.apis.pet_api_base import BasePetApi
from openapi.generated.server.apis.store_api_base import BaseStoreApi
from openapi.generated.server.main import app
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.order import Order
from openapi.generated.server.models.order_search_criteria import OrderSearchCriteria
from openapi.generated.server.models.pet import Pet
from openapi.generated.server.models.pet_search_criteria import PetSearchCriteria
from openapi.generated.server.models.pet_status import PetStatus
from openapi.generated.server.security_api import get_token_api_key
from openapi.service import (
    add_pet,
    delete_order,
    delete_pet,
    find_pets_by_status,
    find_pets_by_tags,
    get_inventory,
    get_order_by_id,
    get_pet_by_id,
    place_order,
    search_orders,
    search_pets,
    update_pet,
    update_pet_with_form,
    upload_pet_image,
)

__all__ = ["API_KEY", "app"]

API_KEY = "some-api-key"


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    await init_db()
    yield


app.router.lifespan_context = lifespan

_api_key_header = APIKeyHeader(name="api_key", auto_error=False)


async def require_api_key(
    key: Optional[str] = Security(_api_key_header),
) -> None:
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


app.dependency_overrides[get_token_api_key] = require_api_key


@asynccontextmanager
async def _session_scope() -> AsyncIterator[AsyncSession]:
    dependency = app.dependency_overrides.get(get_session, get_session)
    session_generator: AsyncGenerator[AsyncSession, None] = dependency()
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


def _criteria_dict(criteria: PetSearchCriteria | OrderSearchCriteria) -> dict[str, Any]:
    return criteria.model_dump(mode="json", by_alias=True, exclude_none=True)


class PetstoreApi(BasePetApi, BaseStoreApi):
    async def add_pet(self, pet: Pet) -> Pet:
        async with _session_scope() as session:
            return await add_pet(session, pet)

    async def update_pet(self, pet: Pet) -> Pet:
        async with _session_scope() as session:
            return await update_pet(session, pet)

    async def find_pets_by_status(self, status: Optional[PetStatus]) -> list[Pet]:
        async with _session_scope() as session:
            return await find_pets_by_status(
                session, status.value if status is not None else "available"
            )

    async def find_pets_by_tags(self, tags: Optional[list[str]]) -> list[Pet]:
        async with _session_scope() as session:
            return await find_pets_by_tags(session, tags or [])

    async def search_pets(
        self, pet_search_criteria: PetSearchCriteria, limit: Any, offset: Any
    ) -> Any:
        async with _session_scope() as session:
            return await search_pets(
                session,
                _criteria_dict(pet_search_criteria),
                limit=int(limit if limit is not None else 20),
                offset=int(offset if offset is not None else 0),
            )

    async def get_pet_by_id(self, petId: int | float) -> Pet:
        async with _session_scope() as session:
            return await get_pet_by_id(session, int(petId))

    async def update_pet_with_form(
        self, petId: int | float, name: Optional[str], status: Optional[PetStatus]
    ) -> object:
        async with _session_scope() as session:
            return await update_pet_with_form(
                session,
                int(petId),
                name,
                status.value if status is not None else None,
            )

    async def delete_pet(self, petId: int | float) -> object:
        async with _session_scope() as session:
            return await delete_pet(session, int(petId))

    async def upload_pet_image(
        self,
        petId: int | float,
        additional_metadata: Optional[str],
        body: Optional[Union[bytes, str, Tuple[str, bytes]]],
    ) -> ApiResponse:
        if isinstance(body, bytes):
            data = body
        elif isinstance(body, str):
            data = body.encode()
        elif body is None:
            data = b""
        else:
            data = body[1]
        async with _session_scope() as session:
            return await upload_pet_image(
                session, int(petId), data, additional_metadata
            )

    async def get_inventory(self) -> dict[str, int]:
        async with _session_scope() as session:
            return await get_inventory(session)

    async def place_order(self, order: Order) -> Order:
        async with _session_scope() as session:
            return await place_order(session, order)

    async def search_orders(
        self, order_search_criteria: OrderSearchCriteria, page: Any, page_size: Any
    ) -> Any:
        async with _session_scope() as session:
            return await search_orders(
                session,
                _criteria_dict(order_search_criteria),
                page=int(page if page is not None else 1),
                page_size=int(page_size if page_size is not None else 20),
            )

    async def get_order_by_id(self, orderId: int | float) -> Order:
        async with _session_scope() as session:
            return await get_order_by_id(session, int(orderId))

    async def delete_order(self, orderId: int | float) -> object:
        async with _session_scope() as session:
            return await delete_order(session, int(orderId))


if __name__ == "__main__":
    uvicorn.run("openapi.server:app", host="0.0.0.0", port=8000, reload=False)
