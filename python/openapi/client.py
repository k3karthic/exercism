from __future__ import annotations

from typing import Any

from openapi.generated.client.api.default_api import DefaultApi
from openapi.generated.client.api_client import ApiClient as GeneratedApiClient
from openapi.generated.client.configuration import Configuration


class Client:
    """Stable facade over the OpenAPI Generator Python client."""

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        *,
        verify_ssl: bool = True,
    ) -> None:
        configuration = Configuration(
            host=base_url,
            api_key={"APIKeyHeader": api_key} if api_key is not None else None,
            verify_ssl=verify_ssl,
        )
        self._client = GeneratedApiClient(configuration=configuration)
        self._api = DefaultApi(api_client=self._client)

    @property
    def api(self) -> DefaultApi:
        return self._api

    def get_inventory(self) -> dict[str, int]:
        inventory = self._api.get_inventory_store_inventory_get()
        if inventory is None:
            raise RuntimeError("Inventory request returned no data")
        return inventory

    def __enter__(self) -> Client:
        self._client.__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: Any,
    ) -> None:
        self._client.__exit__(exc_type, exc_value, traceback)


class AuthenticatedClient(Client):
    def __init__(
        self,
        base_url: str,
        token: str,
        prefix: str = "",
        auth_header_name: str = "api_key",
        *,
        verify_ssl: bool = True,
    ) -> None:
        if auth_header_name != "api_key":
            raise ValueError(
                "The generated API client only supports the api_key header"
            )
        api_key = f"{prefix} {token}" if prefix else token
        super().__init__(base_url, api_key, verify_ssl=verify_ssl)
