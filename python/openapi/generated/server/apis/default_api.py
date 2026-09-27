# coding: utf-8

from typing import Dict, List  # noqa: F401
import importlib
import pkgutil

from openapi.generated.server.apis.default_api_base import BaseDefaultApi
import openapi.generated.server.impl

from fastapi import (  # noqa: F401
    APIRouter,
    Body,
    Cookie,
    Depends,
    Form,
    Header,
    HTTPException,
    Path,
    Query,
    Response,
    Security,
    status,
)

from openapi.generated.server.models.extra_models import TokenModel  # noqa: F401
from pydantic import Field, StrictBytes, StrictInt, StrictStr
from typing import Any, Dict, List, Optional, Tuple, Union
from typing_extensions import Annotated
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.http_validation_error import HTTPValidationError
from openapi.generated.server.models.order import Order
from openapi.generated.server.models.pet import Pet
from openapi.generated.server.security_api import get_token_APIKeyHeader

router = APIRouter()

ns_pkg = openapi.generated.server.impl
for _, name, _ in pkgutil.iter_modules(ns_pkg.__path__, ns_pkg.__name__ + "."):
    importlib.import_module(name)


@router.put(
    "/pet",
    responses={
        200: {"model": Pet, "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Update Pet",
    response_model_by_alias=True,
)
async def update_pet_pet_put(
    pet: Pet = Body(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Pet:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().update_pet_pet_put(pet)


@router.post(
    "/pet",
    responses={
        200: {"model": Pet, "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Add Pet",
    response_model_by_alias=True,
)
async def add_pet_pet_post(
    pet: Pet = Body(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Pet:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().add_pet_pet_post(pet)


@router.get(
    "/pet/findByStatus",
    responses={
        200: {"model": List[Pet], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Find Pets By Status",
    response_model_by_alias=True,
)
async def find_pets_by_status_pet_find_by_status_get(
    status: Optional[Any] = Query(None, description="", alias="status")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> List[Pet]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().find_pets_by_status_pet_find_by_status_get(status)


@router.get(
    "/pet/findByTags",
    responses={
        200: {"model": List[Pet], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Find Pets By Tags",
    response_model_by_alias=True,
)
async def find_pets_by_tags_pet_find_by_tags_get(
    tags: Optional[List[Optional[StrictStr]]] = Query([], description="", alias="tags")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> List[Pet]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().find_pets_by_tags_pet_find_by_tags_get(tags)


@router.post(
    "/pet/search",
    responses={
        200: {"model": Dict[str, object], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Search Pets",
    response_model_by_alias=True,
)
async def search_pets_pet_search_post(
    request_body: Dict[str, Any] = Body(..., description="")
,
    limit: Optional[Annotated[int, Field(le=100, ge=1)]] = Query(20, description="", alias="limit", ge=1, le=100)
,
    offset: Optional[Annotated[int, Field(ge=0)]] = Query(0, description="", alias="offset", ge=0)
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Dict[str, object]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().search_pets_pet_search_post(request_body, limit, offset)


@router.get(
    "/pet/{petId}",
    responses={
        200: {"model": Pet, "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Get Pet By Id",
    response_model_by_alias=True,
)
async def get_pet_by_id_pet_pet_id_get(
    petId: StrictInt = Path(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Pet:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().get_pet_by_id_pet_pet_id_get(petId)


@router.post(
    "/pet/{petId}",
    responses={
        200: {"model": Dict[str, object], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Update Pet With Form",
    response_model_by_alias=True,
)
async def update_pet_with_form_pet_pet_id_post(
    petId: StrictInt = Path(..., description="")
,
    name: Optional[StrictStr] = Query(None, description="", alias="name")
,
    status: Optional[StrictStr] = Query(None, description="", alias="status")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Dict[str, object]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().update_pet_with_form_pet_pet_id_post(petId, name, status)


@router.delete(
    "/pet/{petId}",
    responses={
        200: {"model": Dict[str, object], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Delete Pet",
    response_model_by_alias=True,
)
async def delete_pet_pet_pet_id_delete(
    petId: StrictInt = Path(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Dict[str, object]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().delete_pet_pet_pet_id_delete(petId)


@router.post(
    "/pet/{petId}/uploadImage",
    responses={
        200: {"model": ApiResponse, "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Upload Pet Image",
    response_model_by_alias=True,
)
async def upload_pet_image_pet_pet_id_upload_image_post(
    petId: StrictInt = Path(..., description="")
,
    additional_metadata: Optional[StrictStr] = Query(None, description="", alias="additionalMetadata")
,
    body: Optional[Union[StrictBytes, StrictStr, Tuple[StrictStr, StrictBytes]]] = Body(None, description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> ApiResponse:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().upload_pet_image_pet_pet_id_upload_image_post(petId, additional_metadata, body)


@router.get(
    "/store/inventory",
    responses={
        200: {"model": Dict[str, int], "description": "Successful Response"},
    },
    tags=["default"],
    summary="Get Inventory",
    response_model_by_alias=True,
)
async def get_inventory_store_inventory_get(
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Dict[str, int]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().get_inventory_store_inventory_get()


@router.post(
    "/store/order",
    responses={
        200: {"model": Order, "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Place Order",
    response_model_by_alias=True,
)
async def place_order_store_order_post(
    order: Order = Body(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Order:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().place_order_store_order_post(order)


@router.post(
    "/store/order/search",
    responses={
        200: {"model": Dict[str, object], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Search Orders",
    response_model_by_alias=True,
)
async def search_orders_store_order_search_post(
    request_body: Dict[str, Any] = Body(..., description="")
,
    page: Optional[Annotated[int, Field(ge=1)]] = Query(1, description="", alias="page", ge=1)
,
    page_size: Optional[Annotated[int, Field(le=100, ge=1)]] = Query(20, description="", alias="pageSize", ge=1, le=100)
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Dict[str, object]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().search_orders_store_order_search_post(request_body, page, page_size)


@router.get(
    "/store/order/{orderId}",
    responses={
        200: {"model": Order, "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Get Order By Id",
    response_model_by_alias=True,
)
async def get_order_by_id_store_order_order_id_get(
    orderId: StrictInt = Path(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Order:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().get_order_by_id_store_order_order_id_get(orderId)


@router.delete(
    "/store/order/{orderId}",
    responses={
        200: {"model": Dict[str, object], "description": "Successful Response"},
        422: {"model": HTTPValidationError, "description": "Validation Error"},
    },
    tags=["default"],
    summary="Delete Order",
    response_model_by_alias=True,
)
async def delete_order_store_order_order_id_delete(
    orderId: StrictInt = Path(..., description="")
,
    token_APIKeyHeader: TokenModel = Security(
        get_token_APIKeyHeader
    ),
) -> Dict[str, object]:
    if not BaseDefaultApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseDefaultApi.subclasses[0]().delete_order_store_order_order_id_delete(orderId)
