import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

import request from "supertest";
import { afterAll, beforeAll, test } from "vitest";

import {
  DEFAULT_MESSAGES,
  Service1,
  Service2,
  type WorkflowResult,
} from "./app.js";

let service2: Service2;
let service2Server: Server;
let service2Url: string;
let service1: Service1;

async function startServer(
  app: Service2["app"],
): Promise<{ server: Server; url: string }> {
  return await new Promise((resolve, reject) => {
    const server = createServer(app);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("failed to start service"));
        return;
      }

      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

beforeAll(async () => {
  service2 = new Service2();
  const runtime = await startServer(service2.app);
  service2Server = runtime.server;
  service2Url = runtime.url;
  service1 = new Service1(service2Url);
});

afterAll(async () => {
  service1.telemetry.shutdown();
  service2.telemetry.shutdown();
  await new Promise<void>((resolve, reject) => {
    service2Server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test("service 1 calls service 2 over HTTP", async () => {
  const response = await request(service1.app).post("/run");

  assert.equal(response.status, 200);
  const payload = response.body as WorkflowResult;
  assert.deepEqual(
    payload.results.map((item) => item.doubled),
    [2, 4, 6, 8],
  );
  assert.deepEqual(
    payload.failures.map((item) => item.value),
    ["oops"],
  );
  assert.equal(
    new Set(payload.results.map((item) => item.traceId)).size,
    payload.results.length,
  );
  assert.ok(payload.results.length > 0);
  assert.ok(DEFAULT_MESSAGES.includes(payload.results[0]?.value ?? ""));
});

test("service 2 rejects invalid number", async () => {
  const response = await request(service2.app).post("/double").send({
    value: "oops",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.detail, "value must be numeric");
});
