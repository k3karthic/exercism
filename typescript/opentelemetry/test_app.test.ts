import assert from "node:assert/strict";

import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { afterEach, test } from "vitest";

import { Service1 } from "./app.js";
import { Service2 } from "./service-2-process.js";
import { DEFAULT_MESSAGES, TelemetryBundle, type WorkflowResult } from "./utils.js";

const services: Array<Service1 | Service2> = [];

afterEach(async () => {
  await Promise.all(services.map((service) => service.telemetry.shutdown()));
  services.length = 0;
});

test("service 1 calls service 2 via subprocess", async () => {
  const service1 = new Service1();
  services.push(service1);

  const payload: WorkflowResult = await service1.sendNumbersToService2();

  assert.deepEqual(
    payload.results.map((item) => item.doubled),
    [2, 4, 6, 8],
  );
  assert.deepEqual(
    payload.failures.map((item) => item.value),
    ["oops"],
  );
  assert.equal(new Set(payload.results.map((item) => item.traceId)).size, payload.results.length);
  assert.ok(payload.results.length > 0);
  assert.ok(DEFAULT_MESSAGES.includes(payload.results[0]?.value ?? ""));
});

test("subprocess span nests under the caller's trace", async () => {
  // The subprocess has no OTel SDK/propagator wired into its transport, so
  // this proves the manually propagated (via TRACEPARENT/TRACESTATE env
  // vars + propagation.inject/extract) context still produces a child span
  // sharing the parent's trace id.
  const exporter = new InMemorySpanExporter();
  const telemetry = new TelemetryBundle("service_1", [new SimpleSpanProcessor(exporter)]);
  const service1 = new Service1(telemetry);
  services.push(service1);

  const payload: WorkflowResult = await service1.sendNumbersToService2(["3"]);

  const doubled = payload.results[0];
  assert.ok(doubled);
  const parentSpans = exporter.getFinishedSpans();
  assert.ok(parentSpans.length > 0, "expected service_1 to emit a span");
  const parentTraceId = parentSpans[0]?.spanContext().traceId;

  assert.equal(doubled.traceId, parentTraceId);
});

test("service 2 rejects invalid number", async () => {
  const service2 = new Service2();
  services.push(service2);

  await assert.rejects(() => service2.doubleNumber("oops"), /value must be numeric/);
});
