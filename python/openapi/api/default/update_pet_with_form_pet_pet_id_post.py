from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.update_pet_with_form_pet_pet_id_post_response_update_pet_with_form_pet_petid_post import (
    UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost,
)
from ...types import UNSET, Response, Unset


def _get_kwargs(
    pet_id: int,
    *,
    name: None | str | Unset = UNSET,
    status: None | str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_name: None | str | Unset
    if isinstance(name, Unset):
        json_name = UNSET
    else:
        json_name = name
    params["name"] = json_name

    json_status: None | str | Unset
    if isinstance(status, Unset):
        json_status = UNSET
    else:
        json_status = status
    params["status"] = json_status

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/pet/{pet_id}".format(
            pet_id=quote(str(pet_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    HTTPValidationError
    | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
    | None
):
    if response.status_code == 200:
        response_200 = UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost.from_dict(
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
    HTTPValidationError
    | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    pet_id: int,
    *,
    client: AuthenticatedClient,
    name: None | str | Unset = UNSET,
    status: None | str | Unset = UNSET,
) -> Response[
    HTTPValidationError
    | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
]:
    """Update Pet With Form

    Args:
        pet_id (int):
        name (None | str | Unset):
        status (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost]
    """

    kwargs = _get_kwargs(
        pet_id=pet_id,
        name=name,
        status=status,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    pet_id: int,
    *,
    client: AuthenticatedClient,
    name: None | str | Unset = UNSET,
    status: None | str | Unset = UNSET,
) -> (
    HTTPValidationError
    | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
    | None
):
    """Update Pet With Form

    Args:
        pet_id (int):
        name (None | str | Unset):
        status (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
    """

    return sync_detailed(
        pet_id=pet_id,
        client=client,
        name=name,
        status=status,
    ).parsed


async def asyncio_detailed(
    pet_id: int,
    *,
    client: AuthenticatedClient,
    name: None | str | Unset = UNSET,
    status: None | str | Unset = UNSET,
) -> Response[
    HTTPValidationError
    | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
]:
    """Update Pet With Form

    Args:
        pet_id (int):
        name (None | str | Unset):
        status (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost]
    """

    kwargs = _get_kwargs(
        pet_id=pet_id,
        name=name,
        status=status,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    pet_id: int,
    *,
    client: AuthenticatedClient,
    name: None | str | Unset = UNSET,
    status: None | str | Unset = UNSET,
) -> (
    HTTPValidationError
    | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
    | None
):
    """Update Pet With Form

    Args:
        pet_id (int):
        name (None | str | Unset):
        status (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | UpdatePetWithFormPetPetIdPostResponseUpdatePetWithFormPetPetidPost
    """

    return (
        await asyncio_detailed(
            pet_id=pet_id,
            client=client,
            name=name,
            status=status,
        )
    ).parsed
