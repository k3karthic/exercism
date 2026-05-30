from __future__ import annotations

import asyncio
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from redis.asyncio import Redis

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES = Jinja2Templates(directory=str(BASE_DIR / "templates"))
DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/callback/keycloak"
DEFAULT_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/"
DEFAULT_KEYCLOAK_BASE_URL = "http://127.0.0.1:8080"
DEFAULT_KEYCLOAK_REALM = "my-app-realm"
DEFAULT_KEYCLOAK_CLIENT_ID = "my-app-client"
DEFAULT_KEYCLOAK_AUDIENCE_SCOPE = "my-app-audience-scope"
DEFAULT_KEYCLOAK_API_AUDIENCE = "my-app-api"
DEFAULT_SESSION_COOKIE_NAME = "keycloak_session_id"
DEFAULT_SESSION_PREFIX = "keycloak-exercise"
DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 10
DEFAULT_PENDING_LOGIN_TTL_SECONDS = 300


@dataclass(slots=True)
class Settings:
    keycloak_base_url: str = DEFAULT_KEYCLOAK_BASE_URL
    keycloak_realm: str = DEFAULT_KEYCLOAK_REALM
    keycloak_client_id: str = DEFAULT_KEYCLOAK_CLIENT_ID
    keycloak_client_secret: str = ""
    keycloak_audience_scope: str = DEFAULT_KEYCLOAK_AUDIENCE_SCOPE
    keycloak_api_audience: str = DEFAULT_KEYCLOAK_API_AUDIENCE
    redirect_uri: str = DEFAULT_REDIRECT_URI
    post_logout_redirect_uri: str = DEFAULT_POST_LOGOUT_REDIRECT_URI
    redis_url: str = "redis://localhost:6379/0"
    session_cookie_name: str = DEFAULT_SESSION_COOKIE_NAME
    session_prefix: str = DEFAULT_SESSION_PREFIX
    session_ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS
    pending_login_ttl_seconds: int = DEFAULT_PENDING_LOGIN_TTL_SECONDS
    http_timeout_seconds: float = 10.0

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            keycloak_base_url=_env("KEYCLOAK_BASE_URL", DEFAULT_KEYCLOAK_BASE_URL),
            keycloak_realm=_env("KEYCLOAK_REALM", DEFAULT_KEYCLOAK_REALM),
            keycloak_client_id=_env("KEYCLOAK_CLIENT_ID", DEFAULT_KEYCLOAK_CLIENT_ID),
            keycloak_client_secret=_env("KEYCLOAK_CLIENT_SECRET", ""),
            keycloak_audience_scope=_env(
                "KEYCLOAK_AUDIENCE_SCOPE", DEFAULT_KEYCLOAK_AUDIENCE_SCOPE
            ),
            keycloak_api_audience=_env(
                "KEYCLOAK_API_AUDIENCE", DEFAULT_KEYCLOAK_API_AUDIENCE
            ),
            redirect_uri=_env("KEYCLOAK_REDIRECT_URI", DEFAULT_REDIRECT_URI),
            post_logout_redirect_uri=_env(
                "POST_LOGOUT_REDIRECT_URI", DEFAULT_POST_LOGOUT_REDIRECT_URI
            ),
            redis_url=_env("REDIS_URL", "redis://localhost:6379/0"),
        )


@dataclass(slots=True)
class OidcConfiguration:
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    end_session_endpoint: str | None = None


@dataclass(slots=True)
class PendingLogin:
    state: str
    nonce: str
    next_path: str
    created_at: str

    def to_mapping(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "nonce": self.nonce,
            "next_path": self.next_path,
            "created_at": self.created_at,
        }

    @classmethod
    def from_mapping(cls, payload: dict[str, Any]) -> "PendingLogin":
        return cls(
            state=str(payload["state"]),
            nonce=str(payload["nonce"]),
            next_path=str(payload["next_path"]),
            created_at=str(payload["created_at"]),
        )


@dataclass(slots=True)
class SessionRecord:
    session_id: str
    user_name: str
    email: str | None
    subject: str
    id_token: str
    created_at: str
    updated_at: str
    expires_at: str

    def to_mapping(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "user_name": self.user_name,
            "email": self.email,
            "subject": self.subject,
            "id_token": self.id_token,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "expires_at": self.expires_at,
        }

    @classmethod
    def from_mapping(cls, payload: dict[str, Any]) -> "SessionRecord":
        return cls(
            session_id=str(payload["session_id"]),
            user_name=str(payload["user_name"]),
            email=(
                None if payload.get("email") in {None, ""} else str(payload["email"])
            ),
            subject=str(payload["subject"]),
            id_token=str(payload["id_token"]),
            created_at=str(payload["created_at"]),
            updated_at=str(payload["updated_at"]),
            expires_at=str(payload["expires_at"]),
        )


def _env(name: str, default: str) -> str:
    import os

    return os.getenv(name, default)


def _now() -> datetime:
    return datetime.now(UTC)


def _iso_now() -> str:
    return _now().isoformat()


class RedisSessionStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _session_key(self, session_id: str) -> str:
        return f"{self.settings.session_prefix}:session:{session_id}"

    def _pending_key(self, state: str) -> str:
        return f"{self.settings.session_prefix}:pending:{state}"

    def _redis(self) -> Redis:
        return Redis.from_url(self.settings.redis_url, decode_responses=True)

    async def store_pending_login(self, pending: PendingLogin) -> None:
        redis = self._redis()
        try:
            await redis.setex(
                self._pending_key(pending.state),
                self.settings.pending_login_ttl_seconds,
                json.dumps(pending.to_mapping()),
            )
        finally:
            await redis.aclose()

    async def pop_pending_login(self, state: str) -> PendingLogin | None:
        redis = self._redis()
        try:
            key = self._pending_key(state)
            raw = await redis.getdel(key)
            if raw is None:
                return None
            return PendingLogin.from_mapping(json.loads(raw))
        finally:
            await redis.aclose()

    async def create_session(
        self,
        *,
        id_token: str,
        claims: dict[str, Any],
    ) -> SessionRecord:
        now = _iso_now()
        session_id = secrets.token_urlsafe(32)
        expires_at = (
            _now() + timedelta(seconds=self.settings.session_ttl_seconds)
        ).isoformat()
        session = SessionRecord(
            session_id=session_id,
            user_name=str(
                claims.get("preferred_username")
                or claims.get("name")
                or claims.get("email")
                or "Developer"
            ),
            email=(None if claims.get("email") in {None, ""} else str(claims["email"])),
            subject=str(claims["sub"]),
            id_token=id_token,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
        )
        redis = self._redis()
        try:
            await redis.setex(
                self._session_key(session.session_id),
                self.settings.session_ttl_seconds,
                json.dumps(session.to_mapping()),
            )
        finally:
            await redis.aclose()
        return session

    async def get_session(self, session_id: str) -> SessionRecord | None:
        redis = self._redis()
        try:
            raw = await redis.get(self._session_key(session_id))
            if raw is None:
                return None
            return SessionRecord.from_mapping(json.loads(raw))
        finally:
            await redis.aclose()

    async def touch_session(self, session_id: str) -> SessionRecord | None:
        session = await self.get_session(session_id)
        if session is None:
            return None
        updated = SessionRecord(
            session_id=session.session_id,
            user_name=session.user_name,
            email=session.email,
            subject=session.subject,
            id_token=session.id_token,
            created_at=session.created_at,
            updated_at=_iso_now(),
            expires_at=(
                _now() + timedelta(seconds=self.settings.session_ttl_seconds)
            ).isoformat(),
        )
        redis = self._redis()
        try:
            await redis.setex(
                self._session_key(session_id),
                self.settings.session_ttl_seconds,
                json.dumps(updated.to_mapping()),
            )
        finally:
            await redis.aclose()
        return updated

    async def delete_session(self, session_id: str) -> None:
        redis = self._redis()
        try:
            await redis.delete(self._session_key(session_id))
        finally:
            await redis.aclose()

    async def list_sessions(self) -> list[SessionRecord]:
        redis = self._redis()
        sessions: list[SessionRecord] = []
        try:
            async for key in redis.scan_iter(
                match=f"{self.settings.session_prefix}:session:*"
            ):
                raw = await redis.get(key)
                if raw is None:
                    continue
                sessions.append(SessionRecord.from_mapping(json.loads(raw)))
        finally:
            await redis.aclose()

        return sorted(sessions, key=lambda item: item.updated_at, reverse=True)


class KeycloakService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._configuration: OidcConfiguration | None = None

    @property
    def discovery_url(self) -> str:
        return (
            f"{self.settings.keycloak_base_url.rstrip('/')}/realms/"
            f"{self.settings.keycloak_realm}/.well-known/openid-configuration"
        )

    async def configuration(self) -> OidcConfiguration:
        if self._configuration is not None:
            return self._configuration

        async with httpx.AsyncClient(
            timeout=self.settings.http_timeout_seconds
        ) as client:
            response = await client.get(self.discovery_url)
            response.raise_for_status()
            payload = response.json()

        self._configuration = OidcConfiguration(
            issuer=str(payload["issuer"]),
            authorization_endpoint=str(payload["authorization_endpoint"]),
            token_endpoint=str(payload["token_endpoint"]),
            jwks_uri=str(payload["jwks_uri"]),
            end_session_endpoint=payload.get("end_session_endpoint"),
        )
        return self._configuration

    async def authorization_url(self, *, state: str, nonce: str) -> str:
        configuration = await self.configuration()
        query = urlencode(
            {
                "client_id": self.settings.keycloak_client_id,
                "redirect_uri": self.settings.redirect_uri,
                "response_type": "code",
                "scope": f"openid {self.settings.keycloak_audience_scope}",
                "state": state,
                "nonce": nonce,
            }
        )
        return f"{configuration.authorization_endpoint}?{query}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        configuration = await self.configuration()
        data = {
            "grant_type": "authorization_code",
            "client_id": self.settings.keycloak_client_id,
            "code": code,
            "redirect_uri": self.settings.redirect_uri,
        }
        if self.settings.keycloak_client_secret:
            data["client_secret"] = self.settings.keycloak_client_secret

        async with httpx.AsyncClient(
            timeout=self.settings.http_timeout_seconds
        ) as client:
            response = await client.post(configuration.token_endpoint, data=data)
            response.raise_for_status()
            return response.json()

    async def validate_id_token(self, id_token: str, nonce: str) -> dict[str, Any]:
        configuration = await self.configuration()
        jwk_client = jwt.PyJWKClient(configuration.jwks_uri)
        signing_key = await asyncio.to_thread(
            jwk_client.get_signing_key_from_jwt, id_token
        )
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=self.settings.keycloak_client_id,
            issuer=configuration.issuer,
        )
        if claims.get("nonce") != nonce:
            raise HTTPException(status_code=400, detail="invalid login nonce")
        return claims

    async def validate_access_token(self, access_token: str) -> dict[str, Any]:
        configuration = await self.configuration()
        jwk_client = jwt.PyJWKClient(configuration.jwks_uri)
        signing_key = await asyncio.to_thread(
            jwk_client.get_signing_key_from_jwt, access_token
        )
        return jwt.decode(
            access_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=self.settings.keycloak_api_audience,
            issuer=configuration.issuer,
        )

    async def logout_url(self, id_token: str) -> str:
        configuration = await self.configuration()
        endpoint = configuration.end_session_endpoint or (
            f"{self.settings.keycloak_base_url.rstrip('/')}/realms/"
            f"{self.settings.keycloak_realm}/protocol/openid-connect/logout"
        )
        query = urlencode(
            {
                "id_token_hint": id_token,
                "post_logout_redirect_uri": self.settings.post_logout_redirect_uri,
                "client_id": self.settings.keycloak_client_id,
            }
        )
        return f"{endpoint}?{query}"


def _normalize_next_path(next_path: str) -> str:
    if next_path.startswith("/") and not next_path.startswith("//"):
        return next_path
    return "/"


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    session_store = RedisSessionStore(resolved_settings)
    keycloak = KeycloakService(resolved_settings)

    async def get_current_session(request: Request) -> SessionRecord | None:
        session_id = request.cookies.get(resolved_settings.session_cookie_name)
        if not session_id:
            return None
        session = await session_store.touch_session(session_id)
        return session

    app = FastAPI(title="Keycloak FastAPI exercise")
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def home(
        request: Request,
        current_session: SessionRecord | None = Depends(get_current_session),
    ):
        if current_session is None:
            return RedirectResponse(url="/api/auth/login?next=/", status_code=303)

        active_sessions = await session_store.list_sessions()
        context = {
            "request": request,
            "title": "FastAPI SSR Home",
            "user_name": current_session.user_name,
            "session": current_session,
            "active_sessions": active_sessions,
        }
        return TEMPLATES.TemplateResponse(request, "index.html", context)

    @app.get("/api/auth/login")
    async def login(next: str = "/") -> RedirectResponse:
        state = secrets.token_urlsafe(24)
        nonce = secrets.token_urlsafe(24)
        await session_store.store_pending_login(
            PendingLogin(
                state=state,
                nonce=nonce,
                next_path=_normalize_next_path(next),
                created_at=_iso_now(),
            )
        )
        auth_url = await keycloak.authorization_url(state=state, nonce=nonce)
        return RedirectResponse(url=auth_url, status_code=303)

    @app.get("/api/auth/callback/keycloak")
    async def keycloak_callback(code: str, state: str) -> RedirectResponse:
        pending = await session_store.pop_pending_login(state)
        if pending is None:
            raise HTTPException(status_code=400, detail="invalid login state")

        token_payload = await keycloak.exchange_code(code)
        id_token = str(token_payload["id_token"])
        access_token = token_payload.get("access_token")
        if access_token is None:
            raise HTTPException(status_code=502, detail="missing access token")
        claims = await keycloak.validate_id_token(id_token, pending.nonce)
        await keycloak.validate_access_token(str(access_token))
        session = await session_store.create_session(id_token=id_token, claims=claims)

        response = RedirectResponse(
            url=_normalize_next_path(pending.next_path), status_code=303
        )
        response.set_cookie(
            key=resolved_settings.session_cookie_name,
            value=session.session_id,
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
            max_age=resolved_settings.session_ttl_seconds,
        )
        return response

    @app.post("/logout")
    async def logout(
        current_session: SessionRecord | None = Depends(get_current_session),
    ) -> RedirectResponse:
        logout_url = resolved_settings.post_logout_redirect_uri
        if current_session is not None:
            await session_store.delete_session(current_session.session_id)
            logout_url = await keycloak.logout_url(current_session.id_token)
        response = RedirectResponse(url=logout_url, status_code=303)
        response.delete_cookie(resolved_settings.session_cookie_name, path="/")
        return response

    return app


app = create_app()
