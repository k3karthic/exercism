// Subprocess entry point simulating an integration with no OTel SDK.
//
// This script stands in for a real external system (a legacy script,
// another team's CLI, a queue worker written in a different stack) that has
// no OpenTelemetry auto-instrumentation for its transport. `Service1` in
// `app.ts` spawns this file as a subprocess (via `tsx`) and hands it trace
// context through environment variables instead of an HTTP/gRPC call a
// propagator library would normally intercept for you.

import { context, propagation } from "@opentelemetry/api";

import { Service2, type DoubleResponse } from "./app.js";

async function main(): Promise<void> {
  const value = process.argv[2];
  if (value === undefined) {
    throw new Error("expected a value argument");
  }

  // Constructing Service2 registers its TelemetryBundle's tracer provider
  // globally (context manager + W3C propagator), which propagation.extract
  // below depends on. See TelemetryBundle in app.ts.
  const service2 = new Service2();

  // The carrier is whatever "headers" a real transport would have carried
  // across the wire. Here it's just the environment variables Service1 set
  // before spawning this process.
  const carrier: Record<string, string> = {};
  if (process.env.TRACEPARENT !== undefined) {
    carrier.traceparent = process.env.TRACEPARENT;
  }
  if (process.env.TRACESTATE !== undefined) {
    carrier.tracestate = process.env.TRACESTATE;
  }

  // In production, an HTTP server framework's OTel instrumentation (or a
  // gRPC server interceptor) would call `propagation.extract` for you on
  // every inbound request. Because this "integration" is just a bare
  // subprocess with no such library, we call it ourselves so the child span
  // below nests under the caller's trace.
  const parentContext = propagation.extract(context.active(), carrier);

  let result: DoubleResponse | { value: string; error: string };
  try {
    result = await context.with(parentContext, () =>
      service2.doubleNumber(value),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { value, error: message };
  } finally {
    await service2.telemetry.forceFlush();
    await service2.telemetry.shutdown();
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main();
