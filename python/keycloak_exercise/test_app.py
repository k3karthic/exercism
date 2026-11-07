from __future__ import annotations

import time
from collections.abc import AsyncGenerator, Generator
from re import finditer
from typing import override
from urllib.parse import parse_qs, urljoin, urlparse

import httpx2 as httpx
import pytest
from requests.exceptions import HTTPError
from testcontainers.core.config import testcontainers_config
from testcontainers.keycloak import KeycloakContainer

from keycloak_exercise.app import Settings, create_app

REALM = "my-app-realm"
CLIENT_ID = "my-app-client"
AUDIENCE_SCOPE = "my-app-audience-scope"
USERNAME = "testuser"
PASSWORD = "Password123!"
EMAIL = "testuser@example.com"
APP_BASE_URL = "http://testserver"
CALLBACK_URI = f"{APP_BASE_URL}/api/auth/callback/keycloak"
POST_LOGOUT_REDIRECT_URI = f"{APP_BASE_URL}/"


class _RetryingKeycloakContainer(KeycloakContainer):
    _client_secret: str

    @override
    def _readiness_probe(self) -> None:
        started_at = time.monotonic()
        while True:
            try:
                super()._readiness_probe()
                return
            except HTTPError as error:
                if error.response is None or error.response.status_code != 404:
                    raise
                if time.monotonic() - started_at >= testcontainers_config.timeout:
                    raise TimeoutError("Keycloak did not become ready before the startup timeout") from error
                time.sleep(testcontainers_config.sleep_time)


@pytest.fixture(scope="session")
def keycloak_container() -> Generator[_RetryingKeycloakContainer]:
    with _RetryingKeycloakContainer("quay.io/keycloak/keycloak:latest") as container:
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
        container._client_secret = client_secret
        yield container


def _get_client_secret(container: _RetryingKeycloakContainer) -> str:
    return container._client_secret


@pytest.fixture
def settings(keycloak_container: _RetryingKeycloakContainer) -> Settings:
    return Settings(
        keycloak_base_url=keycloak_container.get_url(),
        keycloak_realm=REALM,
        keycloak_client_id=CLIENT_ID,
        keycloak_client_secret=_get_client_secret(keycloak_container),
        redirect_uri=CALLBACK_URI,
        post_logout_redirect_uri=POST_LOGOUT_REDIRECT_URI,
    )


@pytest.fixture
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture
async def client(app) -> AsyncGenerator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=APP_BASE_URL,
        follow_redirects=False,
        cookies={},
    ) as async_client:
        yield async_client


async def _authenticate(
    client: httpx.AsyncClient,
    keycloak_url: str,
    *,
    next_path: str = "/",
    from_root: bool = True,
) -> str:
    login_path = f"/api/auth/login?next={next_path}"
    if from_root:
        response = await client.get("/", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == login_path

    login_redirect = await client.get(login_path, follow_redirects=False)
    assert login_redirect.status_code in {302, 303}

    auth_url = login_redirect.headers["location"]
    assert parse_qs(urlparse(auth_url).query)["scope"] == [f"openid {AUDIENCE_SCOPE}"]
    async with httpx.AsyncClient(base_url=keycloak_url, follow_redirects=False) as kc:
        auth_redirect = await kc.get(auth_url)
        # Keycloak may redirect from auth endpoint to login page
        if auth_redirect.status_code in {302, 303}:
            # If location is absolute, extract just the path; kc client handles the base URL
            parsed_location = urlparse(auth_redirect.headers.get("location", ""))
            if parsed_location.scheme and parsed_location.netloc:
                login_page_path = parsed_location.path
                if parsed_location.query:
                    login_page_path += f"?{parsed_location.query}"
            else:
                login_page_path = auth_redirect.headers.get("location", "")
            login_page = await kc.get(login_page_path)
        else:
            login_page_path = auth_url
            login_page = auth_redirect
        assert login_page.status_code == 200

        # Extract the form action URL from Keycloak's login page
        action_match = finditer(r'<form[^>]*action=["\']([^"\']+)["\']', login_page.text)
        action = next(action_match).group(1)
        post_url = urljoin(login_page_path, action)

        # Keycloak's login form only needs username, password, and credentialId
        # Manually passing cookies here as httpx does not do the same when follow_redirects=False
        cookie_header = "; ".join(f"{cookie.name}={cookie.value}" for cookie in kc.cookies.jar)
        response = await kc.post(
            post_url,
            data={"username": USERNAME, "password": PASSWORD, "credentialId": ""},
            headers={"Cookie": cookie_header},
            follow_redirects=False,
        )
        assert response.status_code in {302, 303}
        callback_url = response.headers["location"]

    callback = await client.get(callback_url, follow_redirects=False)
    assert callback.status_code in {302, 303}
    return callback.headers["location"]


async def test_root_redirects_when_not_logged_in(client: httpx.AsyncClient) -> None:
    response = await client.get("/", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/api/auth/login?next=/"


async def test_login_shows_welcome(
    client: httpx.AsyncClient,
    keycloak_container: KeycloakContainer,
) -> None:
    await _authenticate(client, keycloak_container.get_url())

    response = await client.get("/", follow_redirects=False)
    assert response.status_code == 200
    assert "Welcome, testuser" in response.text


async def test_logout_clears_session(
    client: httpx.AsyncClient,
    keycloak_container: KeycloakContainer,
) -> None:
    await _authenticate(client, keycloak_container.get_url())

    response = await client.post("/logout", follow_redirects=False)
    assert response.status_code in {302, 303}
    logout_url = response.headers["location"]
    assert logout_url.startswith(f"{keycloak_container.get_url()}/realms/{REALM}/protocol/openid-connect/logout")
    logout_query = parse_qs(urlparse(logout_url).query)
    assert "id_token_hint" in logout_query
    assert logout_query["post_logout_redirect_uri"] == [POST_LOGOUT_REDIRECT_URI]
    assert logout_query["client_id"] == [CLIENT_ID]

    # Session cookie should be deleted
    assert "session=" in response.headers.get("set-cookie", "")

    # After logout, root should redirect to login
    redirected = await client.get("/", follow_redirects=False)
    assert redirected.status_code == 303
    assert redirected.headers["location"] == "/api/auth/login?next=/"


async def test_login_rejects_open_redirect(
    client: httpx.AsyncClient,
    keycloak_container: KeycloakContainer,
) -> None:
    final_location = await _authenticate(
        client,
        keycloak_container.get_url(),
        next_path="https://evil.com",
        from_root=False,
    )
    assert final_location == "/"
