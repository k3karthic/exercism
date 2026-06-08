from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.delete_order_store_order_order_id_delete_response_delete_order_store_order_orderid_delete import (
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete,
)
from ...models.http_validation_error import HTTPValidationError
from ...types import Response


def _get_kwargs(
    order_id: int,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/store/order/{order_id}".format(
            order_id=quote(str(order_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete
    | HTTPValidationError
    | None
):
    if response.status_code == 200:
        response_200 = DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete.from_dict(
            response.json()
        )

        return response_200

    if response.status_code == 422:
        response_422 = HTTPValidationError.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete
    | HTTPValidationError
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    order_id: int,
    *,
    client: AuthenticatedClient,
) -> Response[
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete
    | HTTPValidationError
]:
    """Delete Order

    Args:
        order_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete | HTTPValidationError]
    """

    kwargs = _get_kwargs(
        order_id=order_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    order_id: int,
    *,
    client: AuthenticatedClient,
) -> (
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete
    | HTTPValidationError
    | None
):
    """Delete Order

    Args:
        order_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete | HTTPValidationError
    """

    return sync_detailed(
        order_id=order_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    order_id: int,
    *,
    client: AuthenticatedClient,
) -> Response[
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete
    | HTTPValidationError
]:
    """Delete Order

    Args:
        order_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete | HTTPValidationError]
    """

    kwargs = _get_kwargs(
        order_id=order_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    order_id: int,
    *,
    client: AuthenticatedClient,
) -> (
    DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete
    | HTTPValidationError
    | None
):
    """Delete Order

    Args:
        order_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteOrderStoreOrderOrderIdDeleteResponseDeleteOrderStoreOrderOrderidDelete | HTTPValidationError
    """

    return (
        await asyncio_detailed(
            order_id=order_id,
            client=client,
        )
    ).parsed
