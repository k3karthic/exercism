from __future__ import annotations

from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Tuple, Union

import uvicorn
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from openapi.database import get_session, init_db
from openapi.generated.server.apis.default_api_base import BaseDefaultApi
from openapi.generated.server.main import app
from openapi.generated.server.security_api import get_token_APIKeyHeader
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.order import Order
from openapi.generated.server.models.pet import Pet
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


app.dependency_overrides[get_token_APIKeyHeader] = require_api_key


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


class PetstoreApi(BaseDefaultApi):
    async def add_pet_pet_post(self, pet: Pet) -> Pet:
        async with _session_scope() as session:
            return await add_pet(session, pet)

    async def update_pet_pet_put(self, pet: Pet) -> Pet:
        async with _session_scope() as session:
            return await update_pet(session, pet)

    async def find_pets_by_status_pet_find_by_status_get(
        self, status: Optional[Any]
    ) -> List[Pet]:
        async with _session_scope() as session:
            return await find_pets_by_status(session, str(status or "available"))

    async def find_pets_by_tags_pet_find_by_tags_get(
        self, tags: Optional[List[Optional[str]]]
    ) -> List[Pet]:
        tag_names = [tag for tag in tags or [] if tag is not None]
        async with _session_scope() as session:
            return await find_pets_by_tags(session, tag_names)

    async def search_pets_pet_search_post(
        self, request_body: Dict[str, Any], limit: Optional[int], offset: Optional[int]
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await search_pets(
                session,
                request_body,
                limit=limit if limit is not None else 20,
                offset=offset if offset is not None else 0,
            )

    async def get_pet_by_id_pet_pet_id_get(self, petId: int) -> Pet:
        async with _session_scope() as session:
            return await get_pet_by_id(session, petId)

    async def update_pet_with_form_pet_pet_id_post(
        self, petId: int, name: Optional[str], status: Optional[str]
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await update_pet_with_form(session, petId, name, status)

    async def delete_pet_pet_pet_id_delete(self, petId: int) -> Dict[str, object]:
        async with _session_scope() as session:
            return await delete_pet(session, petId)

    async def upload_pet_image_pet_pet_id_upload_image_post(
        self,
        petId: int,
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
            return await upload_pet_image(session, petId, data, additional_metadata)

    async def get_inventory_store_inventory_get(self) -> Dict[str, int]:
        async with _session_scope() as session:
            return await get_inventory(session)

    async def place_order_store_order_post(self, order: Order) -> Order:
        async with _session_scope() as session:
            return await place_order(session, order)

    async def search_orders_store_order_search_post(
        self,
        request_body: Dict[str, Any],
        page: Optional[int],
        page_size: Optional[int],
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await search_orders(
                session,
                request_body,
                page=page if page is not None else 1,
                page_size=page_size if page_size is not None else 20,
            )

    async def get_order_by_id_store_order_order_id_get(self, orderId: int) -> Order:
        async with _session_scope() as session:
            return await get_order_by_id(session, orderId)

    async def delete_order_store_order_order_id_delete(
        self, orderId: int
    ) -> Dict[str, object]:
        async with _session_scope() as session:
            return await delete_order(session, orderId)


if __name__ == "__main__":
    uvicorn.run("openapi.server:app", host="0.0.0.0", port=8000, reload=False)
