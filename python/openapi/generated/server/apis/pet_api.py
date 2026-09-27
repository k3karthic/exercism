# coding: utf-8

from typing import Dict, List  # noqa: F401
import importlib
import pkgutil

from openapi.generated.server.apis.pet_api_base import BasePetApi
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
)

from openapi.generated.server.models.extra_models import TokenModel  # noqa: F401
from pydantic import StrictBytes, StrictInt, StrictStr
from typing import Optional, Tuple, Union
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.error_response import ErrorResponse
from openapi.generated.server.models.pet import Pet
from openapi.generated.server.models.pet_search_criteria import PetSearchCriteria
from openapi.generated.server.models.pet_search_results import PetSearchResults
from openapi.generated.server.models.pet_status import PetStatus
from openapi.generated.server.security_api import get_token_api_key

router = APIRouter()

ns_pkg = openapi.generated.server.impl
for _, name, _ in pkgutil.iter_modules(ns_pkg.__path__, ns_pkg.__name__ + "."):
    importlib.import_module(name)


@router.put(
    "/pet",
    responses={
        200: {"model": Pet, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def update_pet(
    pet: Pet = Body(..., description=""),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> Pet:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().update_pet(pet)


@router.post(
    "/pet",
    responses={
        200: {"model": Pet, "description": "Ok"},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def add_pet(
    pet: Pet = Body(..., description=""),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> Pet:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().add_pet(pet)


@router.get(
    "/pet/findByStatus",
    responses={
        200: {"model": List[Pet], "description": "Ok"},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def find_pets_by_status(
    status: Optional[PetStatus] = Query(None, description="", alias="status"),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> List[Pet]:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().find_pets_by_status(status)


@router.get(
    "/pet/findByTags",
    responses={
        200: {"model": List[Pet], "description": "Ok"},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def find_pets_by_tags(
    tags: Optional[List[StrictStr]] = Query([], description="", alias="tags"),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> List[Pet]:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().find_pets_by_tags(tags)


@router.post(
    "/pet/search",
    responses={
        200: {"model": PetSearchResults, "description": "Ok"},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def search_pets(
    pet_search_criteria: PetSearchCriteria = Body(..., description=""),
    limit: Optional[int] = Query(20, description="", alias="limit"),
    offset: Optional[int] = Query(0, description="", alias="offset"),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> PetSearchResults:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().search_pets(
        pet_search_criteria, limit, offset
    )


@router.get(
    "/pet/{petId}",
    responses={
        200: {"model": Pet, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def get_pet_by_id(
    petId: StrictInt = Path(..., description=""),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> Pet:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().get_pet_by_id(petId)


@router.post(
    "/pet/{petId}",
    responses={
        200: {"model": object, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def update_pet_with_form(
    petId: StrictInt = Path(..., description=""),
    name: Optional[StrictStr] = Query(None, description="", alias="name"),
    status: Optional[PetStatus] = Query(None, description="", alias="status"),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> object:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().update_pet_with_form(petId, name, status)


@router.delete(
    "/pet/{petId}",
    responses={
        200: {"model": object, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def delete_pet(
    petId: StrictInt = Path(..., description=""),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> object:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().delete_pet(petId)


@router.post(
    "/pet/{petId}/uploadImage",
    responses={
        200: {"model": ApiResponse, "description": "Ok"},
        404: {"model": ErrorResponse, "description": ""},
    },
    tags=["Pet"],
    response_model_by_alias=True,
)
async def upload_pet_image(
    petId: StrictInt = Path(..., description=""),
    additional_metadata: Optional[StrictStr] = Query(
        None, description="", alias="additionalMetadata"
    ),
    body: Optional[Union[StrictBytes, StrictStr, Tuple[StrictStr, StrictBytes]]] = Body(
        None, description=""
    ),
    token_api_key: TokenModel = Security(get_token_api_key),
) -> ApiResponse:
    if not BasePetApi.subclasses:
        raise HTTPException(status_code=500, detail="Not implemented")
    return await BasePetApi.subclasses[0]().upload_pet_image(
        petId, additional_metadata, body
    )
