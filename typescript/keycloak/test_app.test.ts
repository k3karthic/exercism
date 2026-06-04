import assert from "node:assert/strict";

import { GenericContainer, Wait } from "testcontainers";
import { RedisContainer } from "@testcontainers/redis";
import request from "supertest";
import { createClient as createRedisClient } from "redis";
import { afterAll, beforeAll, beforeEach, test } from "vitest";

import {
  DEFAULT_KEYCLOAK_AUDIENCE_SCOPE,
  DEFAULT_KEYCLOAK_API_AUDIENCE,
  DEFAULT_KEYCLOAK_CLIENT_ID,
  DEFAULT_KEYCLOAK_REALM,
  DEFAULT_POST_LOGOUT_REDIRECT_URI,
  DEFAULT_SESSION_PREFIX,
  createApp,
  type Settings,
} from "./app.js";

const APP_BASE_URL = "http://127.0.0.1:3000";
const CALLBACK_URI = `${APP_BASE_URL}/api/auth/callback/keycloak`;
const USERNAME = "testuser";
const PASSWORD = "Password123!";
const EMAIL = "testuser@example.com";
const KEYCLOAK_IMAGE = "quay.io/keycloak/keycloak:25.0.6";
const KEYCLOAK_ADMIN_USERNAME = "admin";
const KEYCLOAK_ADMIN_PASSWORD = "admin";

interface KeycloakRuntime {
  container: Awaited<ReturnType<GenericContainer["start"]>>;
  clientSecret: string;
  baseUrl: string;
}

let redisContainer: RedisContainer;
let keycloakRuntime: KeycloakRuntime;
let appSettings: Settings;
let app = createApp();

function buildBaseUrl(container: {
  getHost(): string;
  getMappedPort(port: number): number;
}) {
  return `http://${container.getHost()}:${container.getMappedPort(8080)}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `${init?.method ?? "GET"} ${url} failed with ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

async function getAdminAccessToken(baseUrl: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: KEYCLOAK_ADMIN_USERNAME,
    password: KEYCLOAK_ADMIN_PASSWORD,
  });

  const payload = await fetchJson<{ access_token: string }>(
    `${baseUrl}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  return payload.access_token;
}

async function adminFetch(
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed with ${response.status}`,
    );
  }

  return response;
}

async function createRealm(baseUrl: string, token: string): Promise<void> {
  await adminFetch(baseUrl, token, "/admin/realms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      realm: DEFAULT_KEYCLOAK_REALM,
      enabled: true,
    }),
  });
}

async function createClient(baseUrl: string, token: string): Promise<string> {
  const response = await adminFetch(
    baseUrl,
    token,
    `/admin/realms/${DEFAULT_KEYCLOAK_REALM}/clients`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: DEFAULT_KEYCLOAK_CLIENT_ID,
        name: "My Application Client",
        enabled: true,
        protocol: "openid-connect",
        publicClient: false,
        standardFlowEnabled: true,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        fullScopeAllowed: false,
        redirectUris: [CALLBACK_URI],
        webOrigins: ["+"],
      }),
    },
  );

  const location = response.headers.get("location");
  assert.ok(location);
  return location.split("/").pop() ?? "";
}

async function createClientSecret(
  baseUrl: string,
  token: string,
  clientId: string,
): Promise<string> {
  const payload = await fetchJson<{ value: string }>(
    `${baseUrl}/admin/realms/${DEFAULT_KEYCLOAK_REALM}/clients/${clientId}/client-secret`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );

  return payload.value;
}

async function createClientScope(
  baseUrl: string,
  token: string,
): Promise<string> {
  const response = await adminFetch(
    baseUrl,
    token,
    `/admin/realms/${DEFAULT_KEYCLOAK_REALM}/client-scopes`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: DEFAULT_KEYCLOAK_AUDIENCE_SCOPE,
        protocol: "openid-connect",
        description: "Adds the API audience to tokens only when requested.",
      }),
    },
  );

  const location = response.headers.get("location");
  assert.ok(location);
  return location.split("/").pop() ?? "";
}

async function addMapperToClientScope(
  baseUrl: string,
  token: string,
  scopeId: string,
): Promise<void> {
  await adminFetch(
    baseUrl,
    token,
    `/admin/realms/${DEFAULT_KEYCLOAK_REALM}/client-scopes/${scopeId}/protocol-mappers/models`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "my-app-audience-mapper",
        protocol: "openid-connect",
        protocolMapper: "oidc-audience-mapper",
        config: {
          "included.client.audience": DEFAULT_KEYCLOAK_API_AUDIENCE,
          "id.token.claim": "false",
          "access.token.claim": "true",
        },
      }),
    },
  );
}

async function addOptionalClientScope(
  baseUrl: string,
  token: string,
  clientId: string,
  scopeId: string,
): Promise<void> {
  await adminFetch(
    baseUrl,
    token,
    `/admin/realms/${DEFAULT_KEYCLOAK_REALM}/clients/${clientId}/optional-client-scopes/${scopeId}`,
    { method: "PUT" },
  );
}

async function createUser(baseUrl: string, token: string): Promise<string> {
  await adminFetch(
    baseUrl,
    token,
    `/admin/realms/${DEFAULT_KEYCLOAK_REALM}/users`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: USERNAME,
        enabled: true,
        email: EMAIL,
        emailVerified: true,
        firstName: "Test",
        lastName: "User",
      }),
    },
  );

  const users = await fetchJson<Array<{ id: string }>>(
    `${baseUrl}/admin/realms/${DEFAULT_KEYCLOAK_REALM}/users?username=${encodeURIComponent(USERNAME)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.ok(users[0]?.id);
  return users[0].id;
}

async function setUserPassword(
  baseUrl: string,
  token: string,
  userId: string,
): Promise<void> {
  await adminFetch(
    baseUrl,
    token,
    `/admin/realms/${DEFAULT_KEYCLOAK_REALM}/users/${userId}/reset-password`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "password",
        value: PASSWORD,
        temporary: false,
      }),
    },
  );
}

function parseLoginForm(html: string): {
  action: string;
  fields: Record<string, string>;
} {
  const action = html.match(/<form[^>]*action="([^"]+)"/i)?.[1] ?? "";
  const fields: Record<string, string> = {};

  for (const match of html.matchAll(
    /<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi,
  )) {
    fields[match[1]] = match[2];
  }

  return { action, fields };
}

function cookieHeaderFromSetCookie(setCookie: string | null): string {
  if (!setCookie) {
    return "";
  }

  return setCookie
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";", 1)[0].trim())
    .join("; ");
}

async function authenticateAtKeycloak(
  authUrl: string,
): Promise<{ callbackUrl: string; code: string }> {
  const loginPage = await fetch(authUrl);
  assert.equal(loginPage.status, 200);
  const { action, fields } = parseLoginForm(await loginPage.text());
  assert.ok(action);

  const cookieHeader = cookieHeaderFromSetCookie(
    loginPage.headers.get("set-cookie"),
  );
  const postUrl = new URL(action, authUrl).toString();
  const payloadVariants = [
    { ...fields, username: USERNAME, password: PASSWORD },
    { ...fields, username: USERNAME, password: PASSWORD, credentialId: "" },
    {
      ...fields,
      username: USERNAME,
      password: PASSWORD,
      credentialId: "",
      login: "Sign In",
    },
    { ...fields, username: USERNAME, password: PASSWORD, login: "Sign In" },
  ];

  for (const payload of payloadVariants) {
    const response = await fetch(postUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookieHeader,
      },
      body: new URLSearchParams(payload),
      redirect: "manual",
    });

    if (response.status === 302 || response.status === 303) {
      const callbackUrl = response.headers.get("location");
      assert.ok(callbackUrl);
      const url = new URL(callbackUrl);
      const code = url.searchParams.get("code");
      assert.ok(code);
      return { callbackUrl, code };
    }
  }

  throw new Error("login did not complete");
}

async function bootstrapContainers(): Promise<void> {
  redisContainer = await new RedisContainer("redis:7-alpine").start();
  const keycloakContainer = await new GenericContainer(KEYCLOAK_IMAGE)
    .withExposedPorts(8080)
    .withEnvironment({
      KEYCLOAK_ADMIN: KEYCLOAK_ADMIN_USERNAME,
      KEYCLOAK_ADMIN_PASSWORD: KEYCLOAK_ADMIN_PASSWORD,
    })
    .withCommand(["start-dev", "--http-port", "8080"])
    .withWaitStrategy(
      Wait.forLogMessage(/.*Listening on: http:\/\/0\.0\.0\.0:8080\..*/, 1),
    )
    .withStartupTimeout(180_000)
    .start();

  const baseUrl = buildBaseUrl(keycloakContainer);
  const token = await getAdminAccessToken(baseUrl);
  await createRealm(baseUrl, token);
  const clientId = await createClient(baseUrl, token);
  const clientSecret = await createClientSecret(baseUrl, token, clientId);
  const scopeId = await createClientScope(baseUrl, token);
  await addMapperToClientScope(baseUrl, token, scopeId);
  await addOptionalClientScope(baseUrl, token, clientId, scopeId);
  const userId = await createUser(baseUrl, token);
  await setUserPassword(baseUrl, token, userId);

  keycloakRuntime = {
    container: keycloakContainer,
    clientSecret,
    baseUrl,
  };

  appSettings = {
    keycloakBaseUrl: keycloakRuntime.baseUrl,
    keycloakRealm: DEFAULT_KEYCLOAK_REALM,
    keycloakClientId: DEFAULT_KEYCLOAK_CLIENT_ID,
    keycloakClientSecret: keycloakRuntime.clientSecret,
    keycloakAudienceScope: DEFAULT_KEYCLOAK_AUDIENCE_SCOPE,
    keycloakApiAudience: DEFAULT_KEYCLOAK_API_AUDIENCE,
    redirectUri: CALLBACK_URI,
    postLogoutRedirectUri: DEFAULT_POST_LOGOUT_REDIRECT_URI,
    redisUrl: `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}/0`,
    sessionCookieName: "keycloak_session_id",
    sessionPrefix: DEFAULT_SESSION_PREFIX,
    sessionTtlSeconds: 60 * 60 * 10,
    pendingLoginTtlSeconds: 300,
    httpTimeoutMs: 10_000,
  };

  app = createApp(appSettings);
}

beforeAll(async () => {
  await bootstrapContainers();
}, 240_000);

beforeEach(async () => {
  const redis = createRedisClient({
    url: `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}/0`,
  });
  await redis.connect();
  await redis.flushDb();
  await redis.quit();
});

afterAll(async () => {
  await keycloakRuntime.container.stop();
  await redisContainer.stop();
});

test("root redirects when not logged in", async () => {
  const response = await request(app).get("/").redirects(0);
  assert.equal(response.status, 303);
  assert.equal(response.headers.location, "/api/auth/login?next=/");
});

test("login shows welcome and active sessions", async () => {
  const agent = request.agent(app);
  await authenticate(agent, keycloakRuntime.baseUrl);

  const response = await agent.get("/");
  assert.equal(response.status, 200);
  assert.match(response.text, /Welcome, testuser/);
  assert.equal((response.text.match(/data-session-id=/g) ?? []).length, 1);

  const otherAgent = request.agent(app);
  await authenticate(otherAgent, keycloakRuntime.baseUrl);
  const otherResponse = await otherAgent.get("/");
  assert.equal(otherResponse.status, 200);
  assert.equal((otherResponse.text.match(/data-session-id=/g) ?? []).length, 2);
});

test("access token includes optional audience", async () => {
  const loginResponse = await request(app)
    .get("/api/auth/login?next=/")
    .redirects(0);
  assert.equal(loginResponse.status, 303);
  const authUrl = loginResponse.headers.location as string;

  const { code } = await authenticateAtKeycloak(authUrl);
  const tokenResponse = await fetchJson<{ access_token: string }>(
    `${keycloakRuntime.baseUrl}/realms/${DEFAULT_KEYCLOAK_REALM}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: DEFAULT_KEYCLOAK_CLIENT_ID,
        client_secret: keycloakRuntime.clientSecret,
        code,
        redirect_uri: CALLBACK_URI,
      }),
    },
  );

  const claims = JSON.parse(
    Buffer.from(tokenResponse.access_token.split(".")[1], "base64url").toString(
      "utf8",
    ),
  ) as { aud: string | string[] };
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  assert.ok(audience.includes(DEFAULT_KEYCLOAK_API_AUDIENCE));
});

test("logout clears session", async () => {
  const agent = request.agent(app);
  await authenticate(agent, keycloakRuntime.baseUrl);

  const response = await agent.post("/logout").redirects(0);
  assert.equal(response.status, 303);
  assert.match(
    response.headers.location as string,
    new RegExp(
      `^${keycloakRuntime.baseUrl}/realms/${DEFAULT_KEYCLOAK_REALM}/protocol/openid-connect/logout`,
    ),
  );

  const redis = createRedisClient({
    url: `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}/0`,
  });
  await redis.connect();
  const keys = await redis.keys(`${DEFAULT_SESSION_PREFIX}:session:*`);
  await redis.quit();
  assert.deepEqual(keys, []);

  const redirected = await request(app).get("/").redirects(0);
  assert.equal(redirected.status, 303);
  assert.equal(redirected.headers.location, "/api/auth/login?next=/");
});

test("login rejects open redirect", async () => {
  const response = await request(app)
    .get("/api/auth/login?next=https://evil.com")
    .redirects(0);
  assert.equal(response.status, 303);
  const { callbackUrl } = await authenticateAtKeycloak(
    response.headers.location as string,
  );

  const callback = await request(app)
    .get(new URL(callbackUrl).pathname + new URL(callbackUrl).search)
    .redirects(0);
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.location, "/");
});

async function authenticate(agent: request.SuperAgentTest): Promise<void> {
  const rootResponse = await agent.get("/").redirects(0);
  assert.equal(rootResponse.status, 303);
  assert.equal(rootResponse.headers.location, "/api/auth/login?next=/");

  const loginResponse = await agent.get("/api/auth/login?next=/").redirects(0);
  assert.equal(loginResponse.status, 303);
  const { callbackUrl } = await authenticateAtKeycloak(
    loginResponse.headers.location as string,
  );
  const callback = await agent
    .get(new URL(callbackUrl).pathname + new URL(callbackUrl).search)
    .redirects(0);
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.location, "/");
}
