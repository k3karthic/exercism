"""Integration tests for the Petstore API using Testcontainers for Postgres."""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from openapi.app import Base, get_session, app

API_KEY = "some-api-key"
HEADERS = {"api_key": API_KEY}


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def pg_url():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url().replace("+psycopg2", "+asyncpg")


@pytest.fixture
async def client(pg_url: str):
    """Fresh schema + httpx client per test; get_session is overridden."""
    engine = create_async_engine(pg_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(lambda x: Base.metadata.create_all(bind=x))

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c

    app.dependency_overrides.pop(get_session, None)
    async with engine.begin() as conn:
        await conn.run_sync(lambda x: Base.metadata.drop_all(bind=x))
    await engine.dispose()


# ── Helpers ───────────────────────────────────────────────────────────────────


async def create_pet(
    client: AsyncClient,
    name: str = "Rex",
    status: str = "available",
    pet_id: int | None = None,
) -> dict:
    payload: dict[str, object] = {
        "name": name,
        "photoUrls": ["https://example.com/photo.jpg"],
        "status": status,
    }
    if pet_id is not None:
        payload["id"] = pet_id
    resp = await client.post(
        "/pet",
        json=payload,
        headers=HEADERS,
    )
    assert resp.status_code == 200
    return resp.json()


# ── Pet tests ─────────────────────────────────────────────────────────────────


async def test_add_and_get_pet(client: AsyncClient):
    created = await create_pet(client, "Buddy")
    assert created["name"] == "Buddy"
    assert created["id"] is not None

    resp = await client.get(f"/pet/{created['id']}", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Buddy"


async def test_add_pet_keeps_supplied_id(client: AsyncClient):
    created = await create_pet(client, "Spot", pet_id=1)
    assert created["id"] == 1


async def test_update_pet(client: AsyncClient):
    created = await create_pet(client, "Mittens")

    resp = await client.put(
        "/pet",
        json={**created, "name": "Mittens Updated", "photoUrls": created["photoUrls"]},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Mittens Updated"


async def test_update_pet_with_form(client: AsyncClient):
    created = await create_pet(client, "Whiskers", status="available")

    resp = await client.post(
        f"/pet/{created['id']}",
        params={"name": "Whiskers2", "status": "sold"},
        headers=HEADERS,
    )
    assert resp.status_code == 200

    got = await client.get(f"/pet/{created['id']}", headers=HEADERS)
    data = got.json()
    assert data["name"] == "Whiskers2"
    assert data["status"] == "sold"


async def test_delete_pet(client: AsyncClient):
    created = await create_pet(client, "Goldie")

    resp = await client.delete(f"/pet/{created['id']}", headers=HEADERS)
    assert resp.status_code == 200

    resp = await client.get(f"/pet/{created['id']}", headers=HEADERS)
    assert resp.status_code == 404


async def test_find_by_status(client: AsyncClient):
    await create_pet(client, "AvailPet", status="available")
    await create_pet(client, "SoldPet", status="sold")

    resp = await client.get(
        "/pet/findByStatus", params={"status": "available"}, headers=HEADERS
    )
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "AvailPet" in names
    assert "SoldPet" not in names


async def test_find_by_tags(client: AsyncClient):
    resp = await client.post(
        "/pet",
        json={
            "name": "TaggedPet",
            "photoUrls": [],
            "status": "available",
            "tags": ["fluffy"],
        },
        headers=HEADERS,
    )
    assert resp.status_code == 200

    resp = await client.get(
        "/pet/findByTags", params={"tags": ["fluffy"]}, headers=HEADERS
    )
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "TaggedPet" in names


async def test_upload_image(client: AsyncClient):
    created = await create_pet(client, "PhotoPet")

    resp = await client.post(
        f"/pet/{created['id']}/uploadImage",
        content=b"fake-image-data",
        headers={**HEADERS, "content-type": "application/octet-stream"},
    )
    assert resp.status_code == 200
    assert resp.json()["code"] == 200


async def test_pet_requires_api_key(client: AsyncClient):
    resp = await client.get("/pet/1")
    assert resp.status_code == 403


async def test_get_pet_not_found(client: AsyncClient):
    resp = await client.get("/pet/999999", headers=HEADERS)
    assert resp.status_code == 404


# ── Store tests ───────────────────────────────────────────────────────────────


async def test_place_and_get_order(client: AsyncClient):
    resp = await client.post(
        "/store/order",
        json={"petId": 1, "quantity": 2, "status": "placed", "complete": False},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    order = resp.json()
    assert order["id"] is not None
    assert order["quantity"] == 2

    resp = await client.get(f"/store/order/{order['id']}", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "placed"


async def test_place_order_keeps_supplied_id(client: AsyncClient):
    resp = await client.post(
        "/store/order",
        json={
            "id": 7,
            "petId": 1,
            "quantity": 1,
            "status": "placed",
            "complete": False,
        },
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == 7


async def test_delete_order(client: AsyncClient):
    resp = await client.post(
        "/store/order",
        json={"petId": 2, "quantity": 1, "status": "approved"},
        headers=HEADERS,
    )
    order_id = resp.json()["id"]

    resp = await client.delete(f"/store/order/{order_id}", headers=HEADERS)
    assert resp.status_code == 200

    resp = await client.get(f"/store/order/{order_id}", headers=HEADERS)
    assert resp.status_code == 404


async def test_get_order_not_found(client: AsyncClient):
    resp = await client.get("/store/order/999999", headers=HEADERS)
    assert resp.status_code == 404


async def test_inventory(client: AsyncClient):
    await create_pet(client, "InvPet1", status="available")
    await create_pet(client, "InvPet2", status="available")
    await create_pet(client, "InvPet3", status="sold")

    resp = await client.get("/store/inventory", headers=HEADERS)
    assert resp.status_code == 200
    inv = resp.json()
    assert inv.get("available", 0) >= 2
    assert inv.get("sold", 0) >= 1


async def test_inventory_requires_api_key(client: AsyncClient):
    resp = await client.get("/store/inventory")
    assert resp.status_code == 403


async def test_order_search_query_method(client: AsyncClient):
    resp = await client.post(
        "/store/order",
        json={"petId": 3, "quantity": 4, "status": "delivered", "complete": True},
        headers=HEADERS,
    )
    assert resp.status_code == 200

    resp = await client.request(
        "QUERY",
        "/store/order/search",
        params={"page": 1, "pageSize": 10},
        json={
            "status": ["delivered"],
            "complete": True,
            "sortBy": "ship_date",
            "sortOrder": "desc",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["orders"]


async def test_pet_search_query_method(client: AsyncClient):
    await create_pet(client, "Searchable", status="available")

    resp = await client.request(
        "QUERY",
        "/pet/search",
        params={"limit": 10, "offset": 0},
        json={
            "name": "Search*",
            "status": ["available"],
            "sortBy": "name",
            "sortOrder": "asc",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["results"]
