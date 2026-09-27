# coding: utf-8

from typing import Dict, List  # noqa: F401
import importlib
import pkgutil

from openapi.generated.server.apis.store_api_base import BaseStoreApi
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
from pydantic import StrictInt
from typing import Any, Dict, Optional
from openapi.generated.server.models.error_response import ErrorResponse
from openapi.generated.server.models.order import Order
from openapi.generated.server.models.order_search_criteria import OrderSearchCriteria
from openapi.generated.server.models.order_search_results import OrderSearchResults
from openapi.generated.server.security_api import get_token_api_key

router = APIRouter()

ns_pkg = openapi.generated.server.impl
for _, name, _ in pkgutil.iter_modules(ns_pkg.__path__, ns_pkg.__name__ + "."):
    importlib.import_module(name)


@router.get(
    "/store/inventory",
    responses={
        200: {"model": Dict[str, int], "description": "Ok"},
    },
    tags=["Store"],
    response_model_by_alias=True,
)
async def get_inventory(
    token_api_key: TokenModel = Security(
        get_token_api_key
    ),
) -> Dict[str, int]:
    if not BaseStoreApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseStoreApi.subclasses[0]().get_inventory()


@router.post(
    "/store/order",
    responses={
        200: {"model": Order, "description": "Ok"},
    },
    tags=["Store"],
    response_model_by_alias=True,
)
async def place_order(
    order: Order = Body(..., description="")
,
    token_api_key: TokenModel = Security(
        get_token_api_key
    ),
) -> Order:
    if not BaseStoreApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseStoreApi.subclasses[0]().place_order(order)


@router.post(
    "/store/order/search",
    responses={
        200: {"model": OrderSearchResults, "description": "Ok"},
    },
    tags=["Store"],
    response_model_by_alias=True,
)
async def search_orders(
    order_search_criteria: OrderSearchCriteria = Body(..., description="")
,
    page: Optional[int] = Query(1, description="", alias="page")
,
    page_size: Optional[int] = Query(20, description="", alias="pageSize")
,
    token_api_key: TokenModel = Security(
        get_token_api_key
    ),
) -> OrderSearchResults:
    if not BaseStoreApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseStoreApi.subclasses[0]().search_orders(order_search_criteria, page, page_size)


@router.get(
    "/store/order/{orderId}",
    responses={
        200: {"model": Order, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Store"],
    response_model_by_alias=True,
)
async def get_order_by_id(
    orderId: StrictInt = Path(..., description="")
,
    token_api_key: TokenModel = Security(
        get_token_api_key
    ),
) -> Order:
    if not BaseStoreApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseStoreApi.subclasses[0]().get_order_by_id(orderId)


@router.delete(
    "/store/order/{orderId}",
    responses={
        200: {"model": object, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Store"],
    response_model_by_alias=True,
)
async def delete_order(
    orderId: StrictInt = Path(..., description="")
,
    token_api_key: TokenModel = Security(
        get_token_api_key
    ),
) -> object:
    if not BaseStoreApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BaseStoreApi.subclasses[0]().delete_order(orderId)
