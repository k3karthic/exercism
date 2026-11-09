import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import express, { type NextFunction, type Request, type Response as ExpressResponse } from "express";
import { createClient } from "redis";
import * as client from "openid-client";
import session from "express-session";
import { RedisStore } from "connect-redis";

export const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/callback/keycloak";
export const DEFAULT_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/";
export const DEFAULT_KEYCLOAK_BASE_URL = "http://127.0.0.1:8080";
export const DEFAULT_KEYCLOAK_REALM = "my-app-realm";
export const DEFAULT_KEYCLOAK_CLIENT_ID = "my-app-client";
export const DEFAULT_KEYCLOAK_AUDIENCE_SCOPE = "my-app-audience-scope";
export const DEFAULT_KEYCLOAK_API_AUDIENCE = "my-app-api";
export const DEFAULT_SESSION_COOKIE_NAME = "keycloak_session_id";
export const DEFAULT_SESSION_PREFIX = "keycloak-exercise";
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 10;
export const DEFAULT_PENDING_LOGIN_TTL_SECONDS = 300;
export const DEFAULT_KEYCLOAK_IMAGE = "quay.io/keycloak/keycloak:25.0.6";
export const DEFAULT_PORT = 3000;

export interface Settings {
  keycloakBaseUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  keycloakClientSecret: string;
  keycloakAudienceScope: string;
  keycloakApiAudience: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  redisUrl: string;
  sessionCookieName: string;
  sessionPrefix: string;
  sessionTtlSeconds: number;
  pendingLoginTtlSeconds: number;
  httpTimeoutMs: number;
}

export interface SessionUser {
  userName: string;
  email: string | null;
  subject: string;
  idToken: string;
}

declare module "express-session" {
  interface SessionData {
    pendingLogin?: {
      state: string;
      nonce: string;
      nextPath: string;
    };
    user?: SessionUser;
  }
}

interface TokenClaims {
  nonce?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

function env(name: string, fallback: string | number): string {
  return process.env[name] ?? String(fallback);
}

export function createSettingsFromEnv(): Settings {
  return {
    keycloakBaseUrl: env("KEYCLOAK_BASE_URL", DEFAULT_KEYCLOAK_BASE_URL),
    keycloakRealm: env("KEYCLOAK_REALM", DEFAULT_KEYCLOAK_REALM),
    keycloakClientId: env("KEYCLOAK_CLIENT_ID", DEFAULT_KEYCLOAK_CLIENT_ID),
    keycloakClientSecret: env("KEYCLOAK_CLIENT_SECRET", ""),
    keycloakAudienceScope: env("KEYCLOAK_AUDIENCE_SCOPE", DEFAULT_KEYCLOAK_AUDIENCE_SCOPE),
    keycloakApiAudience: env("KEYCLOAK_API_AUDIENCE", DEFAULT_KEYCLOAK_API_AUDIENCE),
    redirectUri: env("KEYCLOAK_REDIRECT_URI", DEFAULT_REDIRECT_URI),
    postLogoutRedirectUri: env("POST_LOGOUT_REDIRECT_URI", DEFAULT_POST_LOGOUT_REDIRECT_URI),
    redisUrl: env("REDIS_URL", "redis://localhost:6379/0"),
    sessionCookieName: env("SESSION_COOKIE_NAME", DEFAULT_SESSION_COOKIE_NAME),
    sessionPrefix: env("SESSION_PREFIX", DEFAULT_SESSION_PREFIX),
    sessionTtlSeconds: Number(env("SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS)),
    pendingLoginTtlSeconds: Number(env("PENDING_LOGIN_TTL_SECONDS", DEFAULT_PENDING_LOGIN_TTL_SECONDS)),
    httpTimeoutMs: 10_000,
  };
}

function envAsNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function randomToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeNextPath(nextPath: string): string {
  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    return nextPath;
  }

  return "/";
}

function createHtmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function renderHomePage(user: SessionUser): string {
  return createHtmlPage(
    "Keycloak Express Exercise",
    `<main>
      <h1>Welcome, ${escapeHtml(user.userName)}</h1>
      <p>Signed in as ${escapeHtml(user.subject)}</p>
      <form method="post" action="/logout">
        <button type="submit">Log out</button>
      </form>
    </main>`,
  );
}

function buildSessionUser(claims: TokenClaims, idToken: string): SessionUser {
  return {
    userName: String(claims.preferred_username ?? claims.name ?? claims.email ?? "Developer"),
    email: claims.email === undefined || claims.email === "" ? null : String(claims.email),
    subject: String(claims.sub),
    idToken,
  };
}

function getNextPath(value: unknown): string {
  return typeof value === "string" ? value : "/";
}

function asyncHandler(handler: (request: Request, response: ExpressResponse, next: NextFunction) => Promise<void>) {
  return (request: Request, response: ExpressResponse, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export async function createApp(settings: Settings = createSettingsFromEnv()) {
  const issuer = `${settings.keycloakBaseUrl.replace(/\/$/, "")}/realms/${settings.keycloakRealm}`;
  const config = await client.discovery(
    new URL(issuer),
    settings.keycloakClientId,
    undefined,
    settings.keycloakClientSecret ? client.ClientSecretPost(settings.keycloakClientSecret) : undefined,
    {
      execute: [client.allowInsecureRequests],
    },
  );

  const redisClient = createClient({ url: settings.redisUrl });
  redisClient.on("error", (err) => {
    console.error("Redis client error:", err.message);
  });
  await redisClient.connect();
  const redisStore = new RedisStore({ client: redisClient });

  const app = express();

  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      store: redisStore,
      name: settings.sessionCookieName,
      secret: crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: settings.sessionTtlSeconds * 1000,
      },
    }),
  );

  app.get(
    "/",
    asyncHandler(async (request, response) => {
      if (request.session.user === undefined) {
        response.redirect(303, "/api/auth/login?next=/");
        return;
      }

      response.type("html").send(renderHomePage(request.session.user));
    }),
  );

  app.get(
    "/api/auth/login",
    asyncHandler(async (request, response) => {
      const state = randomToken();
      const nonce = randomToken();
      const nextPath = normalizeNextPath(getNextPath(request.query.next));
      request.session.pendingLogin = { state, nonce, nextPath };
      await new Promise<void>((resolve, reject) => {
        request.session.save((err) => (err ? reject(err) : resolve()));
      });

      const authUrl = client.buildAuthorizationUrl(config, {
        state,
        nonce,
        scope: `openid ${settings.keycloakAudienceScope}`,
        redirect_uri: settings.redirectUri,
        iss: issuer,
      });
      response.redirect(303, authUrl.toString());
    }),
  );

  app.get(
    "/api/auth/callback/keycloak",
    asyncHandler(async (request, response) => {
      const state = getNextPath(request.query.state);
      const pending = request.session.pendingLogin;
      if (pending === undefined) {
        response.status(400).type("text").send("invalid login state");
        return;
      }

      const query = request.originalUrl.split("?")[1];
      const callbackUrl = query ? new URL(settings.redirectUri + "?" + query) : new URL(settings.redirectUri);
      const grant = await client.authorizationCodeGrant(config, callbackUrl, {
        expectedState: state,
        expectedNonce: pending.nonce,
      });
      const idToken = grant.id_token;
      const accessToken = grant.access_token;
      if (typeof idToken !== "string") {
        response.status(502).type("text").send("missing id token");
        return;
      }

      if (typeof accessToken !== "string") {
        response.status(502).type("text").send("missing access token");
        return;
      }

      const claims = (grant.claims() ?? {}) as TokenClaims;
      request.session.user = buildSessionUser(claims, idToken);
      delete request.session.pendingLogin;

      response.redirect(303, normalizeNextPath(pending.nextPath));
    }),
  );

  app.post(
    "/logout",
    asyncHandler(async (request, response) => {
      const user = request.session.user;
      let logoutUrl = settings.postLogoutRedirectUri;
      if (user !== undefined) {
        logoutUrl = client
          .buildEndSessionUrl(config, {
            id_token_hint: user.idToken,
            post_logout_redirect_uri: settings.postLogoutRedirectUri,
          })
          .toString();
      }

      await new Promise<void>((resolve, reject) => {
        request.session.destroy((err) => (err ? reject(err) : resolve()));
      });
      response.clearCookie(settings.sessionCookieName, { path: "/" });
      response.redirect(303, logoutUrl);
    }),
  );

  app.use((error: unknown, _request: Request, response: ExpressResponse, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    response.status(500).type("text").send(message);
  });

  return app;
}

async function main(): Promise<void> {
  const app = await createApp();
  const port = envAsNumber(process.env.PORT, DEFAULT_PORT);
  app.listen(port, "127.0.0.1", () => {
    console.log(`Listening on http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
