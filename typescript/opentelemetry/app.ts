import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  context,
  propagation,
  SpanStatusCode,
} from "@opentelemetry/api";
import type { MeterProvider } from "@opentelemetry/sdk-metrics";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import {
  DEFAULT_MESSAGES,
  ServiceLogger,
  TelemetryBundle,
  type DoubleResponse,
  type FailureRecord,
  type WorkflowResult,
} from "./utils.js";

export class Service1 {
  readonly telemetry: TelemetryBundle;
  readonly logger: ServiceLogger;
  readonly tracer: ReturnType<NodeTracerProvider["getTracer"]>;
  readonly meter: ReturnType<MeterProvider["getMeter"]>;
  readonly sentCounter: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createCounter"]
  >;
  readonly failureCounter: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createCounter"]
  >;
  readonly latencyHistogram: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createHistogram"]
  >;

  constructor(telemetry: TelemetryBundle = new TelemetryBundle("service_1")) {
    this.telemetry = telemetry;
    this.logger = new ServiceLogger("service_1", this.telemetry.loggerProvider);
    this.tracer = this.telemetry.tracerProvider.getTracer("otel.service_1");
    this.meter = this.telemetry.meterProvider.getMeter("otel.service_1");
    this.sentCounter = this.meter.createCounter("otel_messages_sent_total");
    this.failureCounter = this.meter.createCounter(
      "otel_messages_failed_total",
    );
    this.latencyHistogram = this.meter.createHistogram(
      "otel_message_round_trip_ms",
    );
  }

  /**
   * Call service_2 across a subprocess boundary, propagating trace context
   * by hand through environment variables.
   *
   * `service-2-process.ts` is a separate process without an instrumented
   * transport layer, so context must be propagated through the environment
   * explicitly. In production, prefer existing instrumentation (e.g.
   * `@opentelemetry/instrumentation-http`, or a gRPC client interceptor)
   * that calls `propagation.inject` for you on every outbound call.
   */
  private callService2(value: string): DoubleResponse {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (carrier.traceparent !== undefined) {
      env.TRACEPARENT = carrier.traceparent;
    }
    if (carrier.tracestate !== undefined) {
      env.TRACESTATE = carrier.tracestate;
    }

    const tsxCliPath = fileURLToPath(import.meta.resolve("tsx/cli"));
    const scriptPath = fileURLToPath(
      new URL("./service-2-process.ts", import.meta.url),
    );
    const stdout = execFileSync(
      process.execPath,
      [tsxCliPath, scriptPath, value],
      { env, encoding: "utf-8" },
    );
    const result = JSON.parse(stdout) as
      | DoubleResponse
      | { value: string; error: string };
    if ("error" in result) {
      throw new Error(result.error);
    }
    return result;
  }

  async sendNumbersToService2(
    messages: readonly string[] = DEFAULT_MESSAGES,
  ): Promise<WorkflowResult> {
    const results: DoubleResponse[] = [];
    const failures: FailureRecord[] = [];

    for (const [index, rawValue] of messages.entries()) {
      const startedAt = performance.now();
      await this.tracer.startActiveSpan(
        "service_1.send_number",
        async (span) => {
          span.setAttribute("message.index", index + 1);
          span.setAttribute("message.value", rawValue);
          try {
            const payload = this.callService2(rawValue);
            span.setAttribute("service_2.trace_id", payload.traceId);
            this.sentCounter.add(1);
            results.push(payload);
            this.logger.info(
              `sent value ${rawValue} and received ${payload.doubled}`,
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            this.failureCounter.add(1);
            failures.push({ value: rawValue, error: message });
            span.recordException(
              error instanceof Error ? error : new Error(message),
            );
            span.setStatus({ code: SpanStatusCode.ERROR, message });
            this.logger.exception(`failed to send value ${rawValue}`, error);
          } finally {
            this.latencyHistogram.record(performance.now() - startedAt);
            span.end();
          }
        },
      );
    }

    return { results, failures };
  }
}

async function main(): Promise<void> {
  const service1 = new Service1();
  try {
    const result = await service1.sendNumbersToService2();
    console.log(JSON.stringify(result, null, 2));
    await service1.telemetry.forceFlush();
  } finally {
    await service1.telemetry.shutdown();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
