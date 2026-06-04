from __future__ import annotations

from collections.abc import AsyncGenerator, Generator
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import parse_qs, urljoin, urlparse

import httpx
import jwt
import pytest
from fastapi import FastAPI
from testcontainers.keycloak import KeycloakContainer
from testcontainers.redis import RedisContainer

from keycloak_exercise.app import Settings, create_app

REALM = "my-app-realm"
CLIENT_ID = "my-app-client"
AUDIENCE_SCOPE = "my-app-audience-scope"
API_AUDIENCE = "my-app-api"
USERNAME = "testuser"
PASSWORD = "Password123!"
EMAIL = "testuser@example.com"
APP_BASE_URL = "http://testserver"
CALLBACK_URI = f"{APP_BASE_URL}/api/auth/callback/keycloak"
POST_LOGOUT_REDIRECT_URI = f"{APP_BASE_URL}/"


@dataclass(slots=True)
class KeycloakRuntime:
    container: KeycloakContainer
    client_secret: str


class _FormParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_form = False
        self.action = ""
        self.fields: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        if tag == "form" and not self._in_form:
            self._in_form = True
            self.action = attributes.get("action", "")
            return

        if self._in_form and tag == "input":
            name = attributes.get("name")
            if name:
                self.fields[name] = attributes.get("value", "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "form" and self._in_form:
            self._in_form = False


@pytest.fixture(scope="session")
def redis_container() -> Generator[RedisContainer, None, None]:
    with RedisContainer("redis:7-alpine") as container:
        yield container


@pytest.fixture(scope="session")
def keycloak_runtime() -> Generator[KeycloakRuntime, None, None]:
    with KeycloakContainer("quay.io/keycloak/keycloak:latest") as container:
        admin = container.get_client()
        admin.create_realm(payload={"realm": REALM, "enabled": True})
        admin.connection.realm_name = REALM
        admin.create_client(
            payload={
                "clientId": CLIENT_ID,
                "name": "My Application Client",
                "enabled": True,
                "protocol": "openid-connect",
                "publicClient": False,
                "standardFlowEnabled": True,
                "implicitFlowEnabled": False,
                "directAccessGrantsEnabled": False,
                "serviceAccountsEnabled": False,
                "fullScopeAllowed": False,
                "redirectUris": [CALLBACK_URI],
                "webOrigins": ["+"],
            }
        )
        client_uuid = admin.get_client_id(CLIENT_ID)
        assert client_uuid is not None
        client_secret = admin.get_client_secrets(client_uuid)["value"]
        scope_id = admin.create_client_scope(
            payload={
                "name": AUDIENCE_SCOPE,
                "protocol": "openid-connect",
                "description": "Adds the API audience to tokens only when requested.",
            }
        )
        admin.add_mapper_to_client_scope(
            scope_id,
            payload={
                "name": "my-app-audience-mapper",
                "protocol": "openid-connect",
                "protocolMapper": "oidc-audience-mapper",
                "config": {
                    "included.client.audience": API_AUDIENCE,
                    "id.token.claim": "false",
                    "access.token.claim": "true",
                },
            },
        )
        admin.add_client_optional_client_scope(
            client_uuid,
            scope_id,
            payload={
                "realm": REALM,
                "client": client_uuid,
                "clientScopeId": scope_id,
            },
        )
        admin.create_user(
            payload={
                "username": USERNAME,
                "enabled": True,
                "email": EMAIL,
                "emailVerified": True,
                "firstName": "Test",
                "lastName": "User",
            }
        )
        user_id = admin.get_user_id(USERNAME)
        assert user_id is not None
        admin.set_user_password(user_id=user_id, password=PASSWORD, temporary=False)
        yield KeycloakRuntime(container=container, client_secret=client_secret)


def _redis_url(container: RedisContainer) -> str:
    host = container.get_container_host_ip()
    port = container.get_exposed_port(container.port)
    return f"redis://{host}:{port}/0"


@pytest.fixture
def settings(
    redis_container: RedisContainer, keycloak_runtime: KeycloakRuntime
) -> Settings:
    return Settings(
        keycloak_base_url=keycloak_runtime.container.get_url(),
        keycloak_realm=REALM,
        keycloak_client_id=CLIENT_ID,
        keycloak_client_secret=keycloak_runtime.client_secret,
        redirect_uri=CALLBACK_URI,
        post_logout_redirect_uri=POST_LOGOUT_REDIRECT_URI,
        redis_url=_redis_url(redis_container),
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture(autouse=True)
def flush_redis(redis_container: RedisContainer) -> None:
    redis = redis_container.get_client(decode_responses=True)
    redis.flushdb()


@pytest.fixture
async def client(app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=APP_BASE_URL,
        follow_redirects=False,
    ) as async_client:
        yield async_client


async def _authenticate(client: httpx.AsyncClient, keycloak_url: str) -> None:
    await _authenticate_with_next(client, keycloak_url, next_path="/")


async def _authenticate_with_next(
    client: httpx.AsyncClient,
    keycloak_url: str,
    *,
    next_path: str,
    from_root: bool = True,
) -> str:
    login_path = f"/api/auth/login?next={next_path}"
    if from_root:
        response = await client.get("/", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == login_path

    login_redirect = await client.get(login_path, follow_redirects=False)
    assert login_redirect.status_code == 303

    auth_url = login_redirect.headers["location"]
    assert parse_qs(urlparse(auth_url).query)["scope"] == [f"openid {AUDIENCE_SCOPE}"]
    async with httpx.AsyncClient(base_url=keycloak_url, follow_redirects=False) as kc:
        login_page = await kc.get(auth_url)
        assert login_page.status_code == 200

        parser = _FormParser()
        parser.feed(login_page.text)
        assert parser.action
        post_url = urljoin(auth_url, parser.action)
        base_form = dict(parser.fields)
        cookie_header = "; ".join(
            f"{cookie.name}={cookie.value}" for cookie in kc.cookies.jar
        )
        payload_variants = [
            {**base_form, "username": USERNAME, "password": PASSWORD},
            {
                **base_form,
                "username": USERNAME,
                "password": PASSWORD,
                "credentialId": "",
            },
            {
                **base_form,
                "username": USERNAME,
                "password": PASSWORD,
                "credentialId": "",
                "login": "Sign In",
            },
            {
                **base_form,
                "username": USERNAME,
                "password": PASSWORD,
                "login": "Sign In",
            },
        ]
        callback_response = None
        for payload in payload_variants:
            response = await kc.post(
                post_url,
                data=payload,
                headers={"Cookie": cookie_header},
                follow_redirects=False,
            )
            if response.status_code in {302, 303}:
                callback_response = response
                break
        assert callback_response is not None
        callback_url = callback_response.headers["location"]

    callback = await client.get(callback_url, follow_redirects=False)
    assert callback.status_code == 303
    return callback.headers["location"]


async def test_root_redirects_when_not_logged_in(client: httpx.AsyncClient) -> None:
    response = await client.get("/", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/api/auth/login?next=/"


async def test_login_shows_welcome_and_active_sessions(
    client: httpx.AsyncClient,
    app: FastAPI,
    keycloak_runtime: KeycloakRuntime,
) -> None:
    await _authenticate(client, keycloak_runtime.container.get_url())

    response = await client.get("/", follow_redirects=False)
    assert response.status_code == 200
    assert "Welcome, testuser" in response.text
    assert response.text.count("data-session-id=") == 1

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=APP_BASE_URL,
        follow_redirects=False,
    ) as other_client:
        await _authenticate(other_client, keycloak_runtime.container.get_url())
        other_response = await other_client.get("/", follow_redirects=False)
        assert other_response.status_code == 200
        assert other_response.text.count("data-session-id=") == 2


async def test_access_token_includes_optional_audience(
    client: httpx.AsyncClient,
    keycloak_runtime: KeycloakRuntime,
) -> None:
    login_redirect = await client.get("/api/auth/login?next=/", follow_redirects=False)
    assert login_redirect.status_code == 303
    auth_url = login_redirect.headers["location"]
    assert parse_qs(urlparse(auth_url).query)["scope"] == [f"openid {AUDIENCE_SCOPE}"]

    async with httpx.AsyncClient(
        base_url=keycloak_runtime.container.get_url(),
        follow_redirects=False,
    ) as kc:
        login_page = await kc.get(auth_url)
        assert login_page.status_code == 200

        parser = _FormParser()
        parser.feed(login_page.text)
        assert parser.action
        post_url = urljoin(auth_url, parser.action)
        payload = {
            **parser.fields,
            "username": USERNAME,
            "password": PASSWORD,
        }
        cookie_header = "; ".join(
            f"{cookie.name}={cookie.value}" for cookie in kc.cookies.jar
        )
        response = await kc.post(
            post_url,
            data=payload,
            headers={"Cookie": cookie_header},
            follow_redirects=False,
        )
        assert response.status_code in {302, 303}
        callback_url = response.headers["location"]

        token_response = await kc.post(
            f"{keycloak_runtime.container.get_url()}/realms/{REALM}/protocol/openid-connect/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": keycloak_runtime.client_secret,
                "code": parse_qs(urlparse(callback_url).query)["code"][0],
                "redirect_uri": CALLBACK_URI,
            },
            follow_redirects=False,
        )
        assert token_response.status_code == 200
        access_token = token_response.json()["access_token"]

    claims = jwt.decode(access_token, options={"verify_signature": False})
    audience = claims["aud"]
    if isinstance(audience, str):
        audience = [audience]
    assert API_AUDIENCE in audience


async def test_logout_clears_session(
    client: httpx.AsyncClient,
    keycloak_runtime: KeycloakRuntime,
    redis_container: RedisContainer,
) -> None:
    await _authenticate(client, keycloak_runtime.container.get_url())

    response = await client.post("/logout", follow_redirects=False)
    assert response.status_code == 303
    logout_url = response.headers["location"]
    assert logout_url.startswith(
        f"{keycloak_runtime.container.get_url()}/realms/{REALM}/protocol/openid-connect/logout"
    )
    logout_query = parse_qs(urlparse(logout_url).query)
    assert "id_token_hint" in logout_query
    assert logout_query["post_logout_redirect_uri"] == [POST_LOGOUT_REDIRECT_URI]
    assert logout_query["client_id"] == [CLIENT_ID]

    redis = redis_container.get_client(decode_responses=True)
    assert list(redis.scan_iter(match="keycloak-exercise:session:*")) == []

    redirected = await client.get("/", follow_redirects=False)
    assert redirected.status_code == 303
    assert redirected.headers["location"] == "/api/auth/login?next=/"


async def test_login_rejects_open_redirect(
    client: httpx.AsyncClient, keycloak_runtime: KeycloakRuntime
) -> None:
    final_location = await _authenticate_with_next(
        client,
        keycloak_runtime.container.get_url(),
        next_path="https://evil.com",
        from_root=False,
    )
    assert final_location == "/"
