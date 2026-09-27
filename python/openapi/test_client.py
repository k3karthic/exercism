from __future__ import annotations

import pytest

from openapi.client import AuthenticatedClient, DefaultApi


def test_client_facade_calls_generated_inventory_operation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        DefaultApi,
        "get_inventory_store_inventory_get",
        lambda self: {"available": 3},
    )

    with AuthenticatedClient(
        base_url="http://localhost",
        token="some-api-key",
        auth_header_name="api_key",
    ) as client:
        assert client.get_inventory() == {"available": 3}
        assert isinstance(client.api, DefaultApi)


def test_client_facade_rejects_unsupported_auth_header() -> None:
    with pytest.raises(ValueError, match="api_key"):
        AuthenticatedClient(
            base_url="http://localhost",
            token="some-api-key",
            auth_header_name="X-API-Key",
        )
