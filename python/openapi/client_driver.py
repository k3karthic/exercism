from __future__ import annotations

import argparse
import json
from typing import Sequence

from openapi.generated.client.api.store_api import StoreApi
from openapi.generated.client.api_client import ApiClient
from openapi.generated.client.configuration import Configuration


def fetch_inventory(base_url: str, api_key: str) -> dict[str, int]:
    configuration = Configuration(
        host=base_url,
        api_key={"api_key": api_key},
    )
    with ApiClient(configuration=configuration) as client:
        inventory = StoreApi(api_client=client).get_inventory()
    if inventory is None:
        raise RuntimeError("Inventory request returned no data")
    return inventory


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Call the Petstore server with the generated OpenAPI client."
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="Server base URL.",
    )
    parser.add_argument(
        "--api-key",
        default="some-api-key",
        help="API key sent as the api_key header.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    inventory = fetch_inventory(args.base_url, args.api_key)
    print(json.dumps(inventory, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
