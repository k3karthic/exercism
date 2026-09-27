# coding: utf-8

from typing import ClassVar, Dict, List, Tuple  # noqa: F401

from pydantic import Field, StrictBytes, StrictInt, StrictStr
from typing import Any, Dict, List, Optional, Tuple, Union
from typing_extensions import Annotated
from openapi.generated.server.models.api_response import ApiResponse
from openapi.generated.server.models.http_validation_error import HTTPValidationError
from openapi.generated.server.models.order import Order
from openapi.generated.server.models.pet import Pet
from openapi.generated.server.security_api import get_token_APIKeyHeader

class BaseDefaultApi:
    subclasses: ClassVar[Tuple] = ()

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        BaseDefaultApi.subclasses = BaseDefaultApi.subclasses + (cls,)
    async def update_pet_pet_put(
        self,
        pet: Pet,
    ) -> Pet:
        ...


    async def add_pet_pet_post(
        self,
        pet: Pet,
    ) -> Pet:
        ...


    async def find_pets_by_status_pet_find_by_status_get(
        self,
        status: Optional[Any],
    ) -> List[Pet]:
        ...


    async def find_pets_by_tags_pet_find_by_tags_get(
        self,
        tags: Optional[List[Optional[StrictStr]]],
    ) -> List[Pet]:
        ...


    async def search_pets_pet_search_post(
        self,
        request_body: Dict[str, Any],
        limit: Optional[Annotated[int, Field(le=100, strict=True, ge=1)]],
        offset: Optional[Annotated[int, Field(strict=True, ge=0)]],
    ) -> Dict[str, object]:
        ...


    async def get_pet_by_id_pet_pet_id_get(
        self,
        petId: StrictInt,
    ) -> Pet:
        ...


    async def update_pet_with_form_pet_pet_id_post(
        self,
        petId: StrictInt,
        name: Optional[StrictStr],
        status: Optional[StrictStr],
    ) -> Dict[str, object]:
        ...


    async def delete_pet_pet_pet_id_delete(
        self,
        petId: StrictInt,
    ) -> Dict[str, object]:
        ...


    async def upload_pet_image_pet_pet_id_upload_image_post(
        self,
        petId: StrictInt,
        additional_metadata: Optional[StrictStr],
        body: Optional[Union[StrictBytes, StrictStr, Tuple[StrictStr, StrictBytes]]],
    ) -> ApiResponse:
        ...


    async def get_inventory_store_inventory_get(
        self,
    ) -> Dict[str, int]:
        ...


    async def place_order_store_order_post(
        self,
        order: Order,
    ) -> Order:
        ...


    async def search_orders_store_order_search_post(
        self,
        request_body: Dict[str, Any],
        page: Optional[Annotated[int, Field(strict=True, ge=1)]],
        page_size: Optional[Annotated[int, Field(le=100, strict=True, ge=1)]],
    ) -> Dict[str, object]:
        ...


    async def get_order_by_id_store_order_order_id_get(
        self,
        orderId: StrictInt,
    ) -> Order:
        ...


    async def delete_order_store_order_order_id_delete(
        self,
        orderId: StrictInt,
    ) -> Dict[str, object]:
        ...
