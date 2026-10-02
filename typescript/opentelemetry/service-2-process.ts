// Service 2 implementation and subprocess entry point.
//
// `Service1` in `app.ts` spawns this file as a subprocess (via `tsx`) and
// hands it trace context through environment variables instead of an
// instrumented HTTP/gRPC transport propagating context automatically.

import { pathToFileURL } from "node:url";

import { context, propagation, SpanStatusCode, type Span } from "@opentelemetry/api";
import type { MeterProvider } from "@opentelemetry/sdk-metrics";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { ServiceLogger, TelemetryBundle, traceIdHex, type DoubleResponse } from "./utils.js";

export class Service2 {
  readonly telemetry: TelemetryBundle;
  readonly logger: ServiceLogger;
  readonly tracer: ReturnType<NodeTracerProvider["getTracer"]>;
  readonly meter: ReturnType<MeterProvider["getMeter"]>;
  readonly doubledCounter: ReturnType<ReturnType<MeterProvider["getMeter"]>["createCounter"]>;
  readonly errorCounter: ReturnType<ReturnType<MeterProvider["getMeter"]>["createCounter"]>;
  readonly durationHistogram: ReturnType<ReturnType<MeterProvider["getMeter"]>["createHistogram"]>;

  constructor() {
    this.telemetry = new TelemetryBundle("service_2");
    this.logger = new ServiceLogger("service_2", this.telemetry.loggerProvider);
    this.tracer = this.telemetry.tracerProvider.getTracer("otel.service_2");
    this.meter = this.telemetry.meterProvider.getMeter("otel.service_2");
    this.doubledCounter = this.meter.createCounter("otel_numbers_doubled_total");
    this.errorCounter = this.meter.createCounter("otel_number_errors_total");
    this.durationHistogram = this.meter.createHistogram("otel_double_duration_ms");
  }

  async doubleNumber(value: string): Promise<DoubleResponse> {
    const startedAt = performance.now();
    return await this.tracer.startActiveSpan("service_2.double_number", async (span: Span) => {
      span.setAttribute("service_2.message.value", value);
      try {
        const number = Number.parseInt(value, 10);
        if (Number.isNaN(number)) {
          const error = new Error("value must be numeric");
          this.errorCounter.add(1);
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          this.logger.exception(`invalid number received: ${value}`, error);
          throw error;
        }

        const doubled = number * 2;
        this.doubledCounter.add(1);
        this.durationHistogram.record(performance.now() - startedAt);
        this.logger.info(`doubled ${number} to ${doubled}`);
        return {
          value,
          doubled,
          traceId: traceIdHex(span),
        };
      } finally {
        span.end();
      }
    });
  }
}

function carrierFromEnv(): Record<string, string> {
  const carrier: Record<string, string> = {};
  const { TRACEPARENT: traceparent, TRACESTATE: tracestate } = process.env;
  if (traceparent !== undefined) {
    carrier.traceparent = traceparent;
  }
  if (tracestate !== undefined) {
    carrier.tracestate = tracestate;
  }
  return carrier;
}

async function main(): Promise<void> {
  const value = process.argv[2];
  if (value === undefined) {
    throw new Error("expected a value argument");
  }

  // Constructing Service2 registers its TelemetryBundle's tracer provider
  // globally (context manager + W3C propagator), which propagation.extract
  // below depends on. See TelemetryBundle in utils.ts.
  const service2 = new Service2();

  // The carrier is whatever "headers" a real transport would have carried
  // across the wire. Here it's just the environment variables Service1 set
  // before spawning this process.
  const carrier = carrierFromEnv();

  // In production, an HTTP server framework's OTel instrumentation (or a
  // gRPC server interceptor) would call `propagation.extract` for you on
  // every inbound request. Because this "integration" is just a bare
  // subprocess with no such library, we call it ourselves so the child span
  // below nests under the caller's trace.
  const parentContext = propagation.extract(context.active(), carrier);

  let result: DoubleResponse | { value: string; error: string };
  try {
    result = await context.with(parentContext, () => service2.doubleNumber(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { value, error: message };
  } finally {
    await service2.telemetry.forceFlush();
    await service2.telemetry.shutdown();
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
