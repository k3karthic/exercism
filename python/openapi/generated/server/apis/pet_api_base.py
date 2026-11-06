# coding: utf-8

from typing import ClassVar, Dict, List, Tuple  # noqa: F401

from pydantic import StrictBytes, StrictInt, StrictStr
from typing import Any, Dict, List, Optional, Tuple, Union
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.error_response import ErrorResponse
from openapi.generated.server.models.pet import Pet
from openapi.generated.server.models.pet_search_criteria import PetSearchCriteria
from openapi.generated.server.models.pet_search_results import PetSearchResults
from openapi.generated.server.models.pet_status import PetStatus
from openapi.generated.server.security_api import get_token_api_key

class BasePetApi:
    subclasses: ClassVar[Tuple] = ()

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        BasePetApi.subclasses = BasePetApi.subclasses + (cls,)
    async def update_pet(
        self,
        pet: Pet,
    ) -> Pet:
        ...


    async def add_pet(
        self,
        pet: Pet,
    ) -> Pet:
        ...


    async def find_pets_by_status(
        self,
        status: Optional[PetStatus],
    ) -> List[Pet]:
        ...


    async def find_pets_by_tags(
        self,
        tags: Optional[List[StrictStr]],
    ) -> List[Pet]:
        ...


    async def search_pets(
        self,
        pet_search_criteria: PetSearchCriteria,
        limit: Optional[StrictInt],
        offset: Optional[StrictInt],
    ) -> PetSearchResults:
        ...


    async def get_pet_by_id(
        self,
        petId: StrictInt,
    ) -> Pet:
        ...


    async def update_pet_with_form(
        self,
        petId: StrictInt,
        name: Optional[StrictStr],
        status: Optional[PetStatus],
    ) -> object:
        ...


    async def delete_pet(
        self,
        petId: StrictInt,
    ) -> object:
        ...


    async def upload_pet_image(
        self,
        petId: StrictInt,
        additional_metadata: Optional[StrictStr],
        body: Optional[Union[StrictBytes, StrictStr, Tuple[StrictStr, StrictBytes]]],
    ) -> ApiResponse:
        ...
