# pylint: disable=too-few-public-methods
from __future__ import annotations

from typing import Any, Self

import pytest
from openapi import client_driver


def test_fetch_inventory_configures_and_calls_generated_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class FakeApiClient:
        def __init__(self, configuration: Any) -> None:
            captured["configuration"] = configuration

        def __enter__(self) -> Self:
            return self

        def __exit__(self, *args: Any) -> None:
            return None

    class FakeStoreApi:
        def __init__(self, api_client: Any) -> None:
            captured["client"] = api_client

        def get_inventory(self) -> dict[str, int]:
            return {"available": 3}

    monkeypatch.setattr(client_driver, "ApiClient", FakeApiClient)
    monkeypatch.setattr(client_driver, "StoreApi", FakeStoreApi)

    assert client_driver.fetch_inventory("http://localhost:8000", "some-api-key") == {
        "available": 3
    }
    configuration = captured["configuration"]
    assert configuration.host == "http://localhost:8000"
    assert configuration.api_key == {"api_key": "some-api-key"}
