from __future__ import annotations

from typing import Any

import pytest
from openapi import client_driver


def test_fetch_inventory_configures_and_calls_generated_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class FakeApiClient:
        def __init__(self, configuration: Any) -> None:
            captured["configuration"] = configuration

        def __enter__(self) -> FakeApiClient:
            return self

        def __exit__(self, *args: Any) -> None:
            return None

    class FakeDefaultApi:
        def __init__(self, api_client: FakeApiClient) -> None:
            captured["client"] = api_client

        def get_inventory_store_inventory_get(self) -> dict[str, int]:
            return {"available": 3}

    monkeypatch.setattr(client_driver, "ApiClient", FakeApiClient)
    monkeypatch.setattr(client_driver, "DefaultApi", FakeDefaultApi)

    assert client_driver.fetch_inventory("http://localhost:8000", "some-api-key") == {
        "available": 3
    }
    configuration = captured["configuration"]
    assert configuration.host == "http://localhost:8000"
    assert configuration.api_key == {"APIKeyHeader": "some-api-key"}
