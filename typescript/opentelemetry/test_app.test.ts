import assert from "node:assert/strict";

import { afterEach, test } from "vitest";

import {
  DEFAULT_MESSAGES,
  Service1,
  Service2,
  type WorkflowResult,
} from "./app.js";

const services: Array<Service1 | Service2> = [];

afterEach(async () => {
  await Promise.all(
    services.map((service) => service.telemetry.shutdown()),
  );
  services.length = 0;
});

test("service 1 calls service 2 directly", async () => {
  const service2 = new Service2();
  const service1 = new Service1(service2);
  services.push(service1, service2);

  const payload: WorkflowResult = await service1.sendNumbersToService2();

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
  const service2 = new Service2();
  services.push(service2);

  await assert.rejects(
    () => service2.doubleNumber("oops"),
    /value must be numeric/,
  );
});
