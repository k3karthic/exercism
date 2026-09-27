# coding: utf-8

from typing import ClassVar, Dict, List, Tuple  # noqa: F401

from pydantic import StrictInt
from typing import Any, Dict, Optional
from openapi.generated.server.models.error_response import ErrorResponse
from openapi.generated.server.models.order import Order
from openapi.generated.server.models.order_search_criteria import OrderSearchCriteria
from openapi.generated.server.models.order_search_results import OrderSearchResults
from openapi.generated.server.security_api import get_token_api_key

class BaseStoreApi:
    subclasses: ClassVar[Tuple] = ()

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        BaseStoreApi.subclasses = BaseStoreApi.subclasses + (cls,)
    async def get_inventory(
        self,
    ) -> Dict[str, int]:
        ...


    async def place_order(
        self,
        order: Order,
    ) -> Order:
        ...


    async def search_orders(
        self,
        order_search_criteria: OrderSearchCriteria,
        page: Optional[StrictInt],
        page_size: Optional[StrictInt],
    ) -> OrderSearchResults:
        ...


    async def get_order_by_id(
        self,
        orderId: StrictInt,
    ) -> Order:
        ...


    async def delete_order(
        self,
        orderId: StrictInt,
    ) -> object:
        ...
