from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from authlib.integrations.starlette_client import OAuth
from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES = Jinja2Templates(directory=str(BASE_DIR / "templates"))
DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/callback/keycloak"
DEFAULT_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/"
DEFAULT_KEYCLOAK_BASE_URL = "http://127.0.0.1:8080"
DEFAULT_KEYCLOAK_REALM = "my-app-realm"
DEFAULT_KEYCLOAK_CLIENT_ID = "my-app-client"
DEFAULT_KEYCLOAK_AUDIENCE_SCOPE = "my-app-audience-scope"
DEFAULT_SESSION_SECRET_KEY = "junie-session-secret-change-me-in-production"


@dataclass(slots=True)
class Settings:
    keycloak_base_url: str = DEFAULT_KEYCLOAK_BASE_URL
    keycloak_realm: str = DEFAULT_KEYCLOAK_REALM
    keycloak_client_id: str = DEFAULT_KEYCLOAK_CLIENT_ID
    keycloak_client_secret: str = ""
    keycloak_audience_scope: str = DEFAULT_KEYCLOAK_AUDIENCE_SCOPE
    redirect_uri: str = DEFAULT_REDIRECT_URI
    post_logout_redirect_uri: str = DEFAULT_POST_LOGOUT_REDIRECT_URI
    session_secret_key: str = DEFAULT_SESSION_SECRET_KEY

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            keycloak_base_url=_env("KEYCLOAK_BASE_URL", DEFAULT_KEYCLOAK_BASE_URL),
            keycloak_realm=_env("KEYCLOAK_REALM", DEFAULT_KEYCLOAK_REALM),
            keycloak_client_id=_env("KEYCLOAK_CLIENT_ID", DEFAULT_KEYCLOAK_CLIENT_ID),
            keycloak_client_secret=_env("KEYCLOAK_CLIENT_SECRET", ""),
            keycloak_audience_scope=_env("KEYCLOAK_AUDIENCE_SCOPE", DEFAULT_KEYCLOAK_AUDIENCE_SCOPE),
            redirect_uri=_env("KEYCLOAK_REDIRECT_URI", DEFAULT_REDIRECT_URI),
            post_logout_redirect_uri=_env("POST_LOGOUT_REDIRECT_URI", DEFAULT_POST_LOGOUT_REDIRECT_URI),
            session_secret_key=_env("SESSION_SECRET_KEY", DEFAULT_SESSION_SECRET_KEY),
        )


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


def _normalize_next_path(next_path: str) -> str:
    if next_path.startswith("/") and not next_path.startswith("//"):
        return next_path
    return "/"


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()

    application = FastAPI(title="Keycloak FastAPI exercise")
    application.add_middleware(SessionMiddleware, secret_key=resolved_settings.session_secret_key)
    application.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

    oauth = OAuth()
    oauth.register(
        "keycloak",
        client_id=resolved_settings.keycloak_client_id,
        client_secret=resolved_settings.keycloak_client_secret,
        server_metadata_url=(
            f"{resolved_settings.keycloak_base_url.rstrip('/')}/realms/"
            f"{resolved_settings.keycloak_realm}/.well-known/openid-configuration"
        ),
        client_kwargs={
            "scope": f"openid {resolved_settings.keycloak_audience_scope}",
        },
        token_endpoint_auth_method="client_secret_post",
    )

    @application.get("/", response_class=HTMLResponse)
    async def home(request: Request):
        user = request.session.get("user")
        if user is None:
            return RedirectResponse(url="/api/auth/login?next=/", status_code=303)
        context = {
            "request": request,
            "title": "FastAPI SSR Home",
            "user_name": user.get("preferred_username") or user.get("name") or user.get("email") or "Developer",
        }
        return TEMPLATES.TemplateResponse(request, "index.html", context)

    @application.get("/api/auth/login")
    async def login(request: Request, next_path: str = Query("/", alias="next")):
        request.session["next"] = _normalize_next_path(next_path)
        redirect_uri = resolved_settings.redirect_uri
        return await oauth.keycloak.authorize_redirect(request, redirect_uri)

    @application.get("/api/auth/callback/keycloak")
    async def callback(request: Request):
        claims_options = {"aud": {"values": [resolved_settings.keycloak_client_id]}}
        token = await oauth.keycloak.authorize_access_token(request, claims_options=claims_options)
        id_token = token.get("id_token")
        userinfo = token.get("userinfo", {})
        request.session["user"] = userinfo
        request.session["id_token"] = id_token
        next_path = request.session.pop("next", "/")
        return RedirectResponse(url=_normalize_next_path(next_path), status_code=303)

    @application.post("/logout")
    async def logout(request: Request):
        id_token = request.session.pop("id_token", None)
        request.session.clear()
        if id_token is not None:
            logout_url = (
                f"{resolved_settings.keycloak_base_url.rstrip('/')}/realms/"
                f"{resolved_settings.keycloak_realm}/protocol/openid-connect/logout"
                f"?id_token_hint={id_token}"
                f"&post_logout_redirect_uri={resolved_settings.post_logout_redirect_uri}"
                f"&client_id={resolved_settings.keycloak_client_id}"
            )
        else:
            logout_url = resolved_settings.post_logout_redirect_uri
        response = RedirectResponse(url=logout_url, status_code=303)
        response.delete_cookie("session", path="/")
        return response

    return application


app = create_app()
