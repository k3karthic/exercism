import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { createClient } from "redis";

export const DEFAULT_REDIRECT_URI =
  "http://localhost:3000/api/auth/callback/keycloak";
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

export interface OidcConfiguration {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  endSessionEndpoint?: string;
}

export interface PendingLogin {
  state: string;
  nonce: string;
  nextPath: string;
  createdAt: string;
}

export interface SessionRecord {
  sessionId: string;
  userName: string;
  email: string | null;
  subject: string;
  idToken: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export function createSettingsFromEnv(): Settings {
  return {
    keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL ?? DEFAULT_KEYCLOAK_BASE_URL,
    keycloakRealm: process.env.KEYCLOAK_REALM ?? DEFAULT_KEYCLOAK_REALM,
    keycloakClientId:
      process.env.KEYCLOAK_CLIENT_ID ?? DEFAULT_KEYCLOAK_CLIENT_ID,
    keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
    keycloakAudienceScope:
      process.env.KEYCLOAK_AUDIENCE_SCOPE ?? DEFAULT_KEYCLOAK_AUDIENCE_SCOPE,
    keycloakApiAudience:
      process.env.KEYCLOAK_API_AUDIENCE ?? DEFAULT_KEYCLOAK_API_AUDIENCE,
    redirectUri: process.env.KEYCLOAK_REDIRECT_URI ?? DEFAULT_REDIRECT_URI,
    postLogoutRedirectUri:
      process.env.POST_LOGOUT_REDIRECT_URI ?? DEFAULT_POST_LOGOUT_REDIRECT_URI,
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379/0",
    sessionCookieName:
      process.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME,
    sessionPrefix: process.env.SESSION_PREFIX ?? DEFAULT_SESSION_PREFIX,
    sessionTtlSeconds: Number(
      process.env.SESSION_TTL_SECONDS ?? DEFAULT_SESSION_TTL_SECONDS,
    ),
    pendingLoginTtlSeconds: Number(
      process.env.PENDING_LOGIN_TTL_SECONDS ??
        DEFAULT_PENDING_LOGIN_TTL_SECONDS,
    ),
    httpTimeoutMs: 10_000,
  };
}

function now(): Date {
  return new Date();
}

function isoNow(): string {
  return now().toISOString();
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

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((cookies, item) => {
    const [name, ...rest] = item.trim().split("=");
    if (!name || rest.length === 0) {
      return cookies;
    }

    cookies[name] = rest.join("=");
    return cookies;
  }, {});
}

function normalizeNextPath(nextPath: string): string {
  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    return nextPath;
  }

  return "/";
}

function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json" };
}

function formHeaders(): Record<string, string> {
  return { "content-type": "application/x-www-form-urlencoded" };
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `${init?.method ?? "GET"} ${url} failed with ${response.status}: ${await readResponseText(response)}`,
    );
  }

  return (await response.json()) as T;
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

function renderHomePage(
  session: SessionRecord,
  sessions: SessionRecord[],
): string {
  const sessionsMarkup = sessions
    .map(
      (item) => `<li data-session-id="${escapeHtml(item.sessionId)}">
          <strong>${escapeHtml(item.userName)}</strong>
          <span>${escapeHtml(item.email ?? "-")}</span>
        </li>`,
    )
    .join("\n");

  return createHtmlPage(
    "Keycloak Express Exercise",
    `<main>
      <h1>Welcome, ${escapeHtml(session.userName)}</h1>
      <p>Signed in as ${escapeHtml(session.subject)}</p>
      <section>
        <h2>Active sessions</h2>
        <ul>
          ${sessionsMarkup}
        </ul>
      </section>
      <form method="post" action="/logout">
        <button type="submit">Log out</button>
      </form>
    </main>`,
  );
}

class RedisSessionStore {
  constructor(private readonly settings: Settings) {}

  private sessionKey(sessionId: string): string {
    return `${this.settings.sessionPrefix}:session:${sessionId}`;
  }

  private pendingKey(state: string): string {
    return `${this.settings.sessionPrefix}:pending:${state}`;
  }

  private client() {
    return createClient({ url: this.settings.redisUrl });
  }

  async storePendingLogin(pending: PendingLogin): Promise<void> {
    const client = this.client();
    await client.connect();
    try {
      await client.set(
        this.pendingKey(pending.state),
        JSON.stringify(pending),
        {
          EX: this.settings.pendingLoginTtlSeconds,
        },
      );
    } finally {
      await client.quit();
    }
  }

  async popPendingLogin(state: string): Promise<PendingLogin | null> {
    const client = this.client();
    await client.connect();
    try {
      const raw = await client.getDel(this.pendingKey(state));
      if (raw === null) {
        return null;
      }

      return JSON.parse(raw) as PendingLogin;
    } finally {
      await client.quit();
    }
  }

  async createSession(options: {
    idToken: string;
    claims: JwtPayload;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      sessionId: randomToken(),
      userName: String(
        options.claims.preferred_username ??
          options.claims.name ??
          options.claims.email ??
          "Developer",
      ),
      email:
        options.claims.email === undefined || options.claims.email === ""
          ? null
          : String(options.claims.email),
      subject: String(options.claims.sub),
      idToken: options.idToken,
      createdAt: isoNow(),
      updatedAt: isoNow(),
      expiresAt: new Date(
        now().getTime() + this.settings.sessionTtlSeconds * 1000,
      ).toISOString(),
    };

    const client = this.client();
    await client.connect();
    try {
      await client.set(
        this.sessionKey(session.sessionId),
        JSON.stringify(session),
        {
          EX: this.settings.sessionTtlSeconds,
        },
      );
    } finally {
      await client.quit();
    }

    return session;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const client = this.client();
    await client.connect();
    try {
      const raw = await client.get(this.sessionKey(sessionId));
      if (raw === null) {
        return null;
      }

      return JSON.parse(raw) as SessionRecord;
    } finally {
      await client.quit();
    }
  }

  async touchSession(sessionId: string): Promise<SessionRecord | null> {
    const session = await this.getSession(sessionId);
    if (session === null) {
      return null;
    }

    const updated: SessionRecord = {
      ...session,
      updatedAt: isoNow(),
      expiresAt: new Date(
        now().getTime() + this.settings.sessionTtlSeconds * 1000,
      ).toISOString(),
    };

    const client = this.client();
    await client.connect();
    try {
      await client.set(this.sessionKey(sessionId), JSON.stringify(updated), {
        EX: this.settings.sessionTtlSeconds,
      });
    } finally {
      await client.quit();
    }

    return updated;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const client = this.client();
    await client.connect();
    try {
      await client.del(this.sessionKey(sessionId));
    } finally {
      await client.quit();
    }
  }

  async listSessions(): Promise<SessionRecord[]> {
    const client = this.client();
    await client.connect();
    try {
      const sessions: SessionRecord[] = [];
      for await (const keys of client.scanIterator({
        MATCH: `${this.settings.sessionPrefix}:session:*`,
      })) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          const raw = await client.get(String(key));
          if (raw === null) {
            continue;
          }

          sessions.push(JSON.parse(raw) as SessionRecord);
        }
      }

      return sessions.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    } finally {
      await client.quit();
    }
  }
}

class KeycloakService {
  private configurationCache: OidcConfiguration | null = null;
  private jwksCache: JsonWebKey[] | null = null;

  constructor(private readonly settings: Settings) {}

  private discoveryUrl(): string {
    return `${this.settings.keycloakBaseUrl.replace(/\/$/, "")}/realms/${this.settings.keycloakRealm}/.well-known/openid-configuration`;
  }

  private async configuration(): Promise<OidcConfiguration> {
    if (this.configurationCache !== null) {
      return this.configurationCache;
    }

    const payload = await fetchJson<Record<string, unknown>>(
      this.discoveryUrl(),
      {
        headers: jsonHeaders(),
      },
    );

    this.configurationCache = {
      issuer: String(payload.issuer),
      authorizationEndpoint: String(payload.authorization_endpoint),
      tokenEndpoint: String(payload.token_endpoint),
      jwksUri: String(payload.jwks_uri),
      endSessionEndpoint:
        typeof payload.end_session_endpoint === "string"
          ? payload.end_session_endpoint
          : undefined,
    };

    return this.configurationCache;
  }

  private async jwks(): Promise<JsonWebKey[]> {
    if (this.jwksCache !== null) {
      return this.jwksCache;
    }

    const configuration = await this.configuration();
    const payload = await fetchJson<{ keys: JsonWebKey[] }>(
      configuration.jwksUri,
      {
        headers: jsonHeaders(),
      },
    );
    this.jwksCache = payload.keys;
    return this.jwksCache;
  }

  private async publicKeyFromJwt(token: string): Promise<crypto.KeyObject> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string") {
      throw new Error("token header is not an object");
    }

    const kid = decoded.header.kid;
    if (!kid) {
      throw new Error("token does not include a key id");
    }

    const jwk = (await this.jwks()).find((item) => item.kid === kid);
    if (jwk === undefined) {
      throw new Error(`unable to find signing key for kid ${kid}`);
    }

    return crypto.createPublicKey({ key: jwk, format: "jwk" });
  }

  async authorizationUrl(state: string, nonce: string): Promise<string> {
    const configuration = await this.configuration();
    const query = new URLSearchParams({
      client_id: this.settings.keycloakClientId,
      redirect_uri: this.settings.redirectUri,
      response_type: "code",
      scope: `openid ${this.settings.keycloakAudienceScope}`,
      state,
      nonce,
    });

    return `${configuration.authorizationEndpoint}?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<Record<string, unknown>> {
    const configuration = await this.configuration();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.settings.keycloakClientId,
      code,
      redirect_uri: this.settings.redirectUri,
    });

    if (this.settings.keycloakClientSecret) {
      body.set("client_secret", this.settings.keycloakClientSecret);
    }

    return await fetchJson<Record<string, unknown>>(
      configuration.tokenEndpoint,
      {
        method: "POST",
        headers: formHeaders(),
        body,
      },
    );
  }

  async validateIdToken(idToken: string, nonce: string): Promise<JwtPayload> {
    const configuration = await this.configuration();
    const key = await this.publicKeyFromJwt(idToken);
    const claims = jwt.verify(idToken, key, {
      algorithms: ["RS256"],
      audience: this.settings.keycloakClientId,
      issuer: configuration.issuer,
    });

    if (typeof claims === "string") {
      throw new Error("id token payload is not an object");
    }

    if (claims.nonce !== nonce) {
      throw new Error("invalid login nonce");
    }

    return claims;
  }

  async validateAccessToken(accessToken: string): Promise<JwtPayload> {
    const configuration = await this.configuration();
    const key = await this.publicKeyFromJwt(accessToken);
    const claims = jwt.verify(accessToken, key, {
      algorithms: ["RS256"],
      audience: this.settings.keycloakApiAudience,
      issuer: configuration.issuer,
    });

    if (typeof claims === "string") {
      throw new Error("access token payload is not an object");
    }

    return claims;
  }

  async logoutUrl(idToken: string): Promise<string> {
    const configuration = await this.configuration();
    const endpoint =
      configuration.endSessionEndpoint ??
      `${this.settings.keycloakBaseUrl.replace(/\/$/, "")}/realms/${this.settings.keycloakRealm}/protocol/openid-connect/logout`;
    const query = new URLSearchParams({
      id_token_hint: idToken,
      post_logout_redirect_uri: this.settings.postLogoutRedirectUri,
      client_id: this.settings.keycloakClientId,
    });

    return `${endpoint}?${query.toString()}`;
  }
}

async function getCurrentSession(
  request: Request,
  sessionStore: RedisSessionStore,
  settings: Settings,
) {
  const cookies = parseCookieHeader(request.headers.cookie);
  const sessionId = cookies[settings.sessionCookieName];
  if (!sessionId) {
    return null;
  }

  return await sessionStore.touchSession(sessionId);
}

function getNextPath(value: unknown): string {
  return typeof value === "string" ? value : "/";
}

function asyncHandler(
  handler: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export function createApp(settings: Settings = createSettingsFromEnv()) {
  const sessionStore = new RedisSessionStore(settings);
  const keycloak = new KeycloakService(settings);
  const app = express();

  app.use(express.urlencoded({ extended: false }));

  app.get(
    "/",
    asyncHandler(async (request, response) => {
      const currentSession = await getCurrentSession(
        request,
        sessionStore,
        settings,
      );
      if (currentSession === null) {
        response.redirect(303, "/api/auth/login?next=/");
        return;
      }

      const sessions = await sessionStore.listSessions();
      response.type("html").send(renderHomePage(currentSession, sessions));
    }),
  );

  app.get(
    "/api/auth/login",
    asyncHandler(async (request, response) => {
      const state = randomToken();
      const nonce = randomToken();
      const nextPath = normalizeNextPath(getNextPath(request.query.next));
      await sessionStore.storePendingLogin({
        state,
        nonce,
        nextPath,
        createdAt: isoNow(),
      });

      const authUrl = await keycloak.authorizationUrl(state, nonce);
      response.redirect(303, authUrl);
    }),
  );

  app.get(
    "/api/auth/callback/keycloak",
    asyncHandler(async (request, response) => {
      const code = getNextPath(request.query.code);
      const state = getNextPath(request.query.state);
      const pending = await sessionStore.popPendingLogin(state);
      if (pending === null) {
        response.status(400).type("text").send("invalid login state");
        return;
      }

      const tokenPayload = await keycloak.exchangeCode(code);
      const idToken = tokenPayload.id_token;
      const accessToken = tokenPayload.access_token;
      if (typeof idToken !== "string") {
        response.status(502).type("text").send("missing id token");
        return;
      }

      if (typeof accessToken !== "string") {
        response.status(502).type("text").send("missing access token");
        return;
      }

      const claims = await keycloak.validateIdToken(idToken, pending.nonce);
      await keycloak.validateAccessToken(accessToken);
      const session = await sessionStore.createSession({
        idToken,
        claims,
      });

      response.cookie(settings.sessionCookieName, session.sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: settings.sessionTtlSeconds * 1000,
      });
      response.redirect(303, normalizeNextPath(pending.nextPath));
    }),
  );

  app.post(
    "/logout",
    asyncHandler(async (request, response) => {
      const currentSession = await getCurrentSession(
        request,
        sessionStore,
        settings,
      );
      let logoutUrl = settings.postLogoutRedirectUri;
      if (currentSession !== null) {
        await sessionStore.deleteSession(currentSession.sessionId);
        logoutUrl = await keycloak.logoutUrl(currentSession.idToken);
      }

      response.clearCookie(settings.sessionCookieName, { path: "/" });
      response.redirect(303, logoutUrl);
    }),
  );

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      const message =
        error instanceof Error ? error.message : "Internal Server Error";
      response.status(500).type("text").send(message);
    },
  );

  return app;
}

async function main(): Promise<void> {
  const app = createApp();
  const port = envAsNumber(process.env.PORT, DEFAULT_PORT);
  app.listen(port, "127.0.0.1", () => {
    console.log(`Listening on http://127.0.0.1:${port}`);
  });
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
