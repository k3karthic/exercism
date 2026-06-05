import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import express, {
  type NextFunction,
  type Request,
  type Response as ExpressResponse,
} from "express";
import {
  propagation,
  trace,
  ROOT_CONTEXT,
  SpanStatusCode,
  type Context,
  type Span,
} from "@opentelemetry/api";
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { SeverityNumber, type Logger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";

export const DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"];
export const DEFAULT_SERVICE_2_URL = "http://127.0.0.1:8002";
export const DEFAULT_PORT = 8002;
const SERVICE_NAMESPACE = "typescript";
const MESSAGE_COUNT_LIMIT = DEFAULT_MESSAGES.length;

propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
  }),
);

export interface NumberRequest {
  value: string;
}

export interface DoubleResponse {
  value: string;
  doubled: number;
  traceId: string;
}

export interface FailureRecord {
  value: string;
  error: string;
}

export interface WorkflowResult {
  results: DoubleResponse[];
  failures: FailureRecord[];
}

type HeaderCarrier = Record<string, string>;

const textMapSetter = {
  set(carrier: HeaderCarrier, key: string, value: string): void {
    carrier[key] = value;
  },
};

const textMapGetter = {
  get(carrier: Record<string, unknown>, key: string): string | undefined {
    const value = carrier[key];
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }

    return undefined;
  },
  keys(carrier: Record<string, unknown>): string[] {
    return Object.keys(carrier);
  },
};

function normalizeEndpoint(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  return `http://${endpoint}`;
}

function traceIdHex(span: Span): string {
  return span.spanContext().traceId;
}

function readResponseText(response: globalThis.Response): Promise<string> {
  return response.text().catch(() => "");
}

class ServiceLogger {
  private readonly logger: Logger;

  constructor(
    private readonly serviceName: string,
    loggerProvider: LoggerProvider,
  ) {
    this.logger = loggerProvider.getLogger(serviceName);
  }

  info(message: string): void {
    console.log(`${this.serviceName}: ${message}`);
    this.logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: message,
    });
  }

  exception(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${this.serviceName}: ${message}: ${errorMessage}`);
    this.logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: message,
      attributes: {
        "exception.message": errorMessage,
      },
    });
  }
}

class TelemetryBundle {
  readonly tracerProvider: NodeTracerProvider;
  readonly meterProvider: MeterProvider;
  readonly loggerProvider: LoggerProvider;

  constructor(serviceName: string) {
    const resource = resourceFromAttributes({
      "service.name": serviceName,
      "service.namespace": SERVICE_NAMESPACE,
    });
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const hasEndpoint = endpoint !== undefined && endpoint !== "";
    const normalizedEndpoint = hasEndpoint ? normalizeEndpoint(endpoint) : "";

    this.tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: hasEndpoint
        ? [
            new BatchSpanProcessor(
              new OTLPTraceExporter({ url: normalizedEndpoint }),
            ),
          ]
        : [],
    });

    this.meterProvider = new MeterProvider({
      resource,
      readers: hasEndpoint
        ? [
            new PeriodicExportingMetricReader({
              exporter: new OTLPMetricExporter({
                url: normalizedEndpoint,
              }),
            }),
          ]
        : [],
    });

    this.loggerProvider = new LoggerProvider({
      resource,
      processors: hasEndpoint
        ? [
            new BatchLogRecordProcessor(
              new OTLPLogExporter({ url: normalizedEndpoint }),
            ),
          ]
        : [],
    });
  }

  async forceFlush(): Promise<void> {
    await Promise.all([
      this.tracerProvider.forceFlush(),
      this.meterProvider.forceFlush(),
      this.loggerProvider.forceFlush(),
    ]);
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.tracerProvider.shutdown(),
      this.meterProvider.shutdown(),
      this.loggerProvider.shutdown(),
    ]);
  }
}

export class Service2 {
  readonly app: express.Express;
  readonly telemetry: TelemetryBundle;
  readonly logger: ServiceLogger;
  readonly tracer: ReturnType<NodeTracerProvider["getTracer"]>;
  readonly meter: ReturnType<MeterProvider["getMeter"]>;
  readonly doubledCounter: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createCounter"]
  >;
  readonly errorCounter: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createCounter"]
  >;
  readonly durationHistogram: ReturnType<
    ReturnType<MeterProvider["getMeter"]>["createHistogram"]
  >;

  autoExit = false;
  messageCount = 0;

  constructor() {
    this.telemetry = new TelemetryBundle("service_2");
    this.logger = new ServiceLogger("service_2", this.telemetry.loggerProvider);
    this.tracer = this.telemetry.tracerProvider.getTracer("otel.service_2");
    this.meter = this.telemetry.meterProvider.getMeter("otel.service_2");
    this.doubledCounter = this.meter.createCounter(
      "otel_numbers_doubled_total",
    );
    this.errorCounter = this.meter.createCounter("otel_number_errors_total");
    this.durationHistogram = this.meter.createHistogram(
      "otel_double_duration_ms",
    );
    this.app = this.createApp();
  }

  private requestExit(): void {
    process.kill(process.pid, "SIGTERM");
  }

  private async flushThenExit(): Promise<void> {
    await this.telemetry.forceFlush();
    await new Promise((resolve) => setTimeout(resolve, 250));
    this.requestExit();
  }

  private maybeScheduleExit(): void {
    if (this.autoExit && this.messageCount >= MESSAGE_COUNT_LIMIT) {
      void this.flushThenExit();
    }
  }

  private createApp(): express.Express {
    const app = express();
    app.use(express.json());

    app.get("/health", (_request, response) => {
      response.json({ status: "ok", service: "service_2" });
    });

    app.post(
      "/double",
      async (
        request: Request<unknown, unknown, NumberRequest>,
        response: ExpressResponse,
      ) => {
        const parentContext = propagation.extract(
          ROOT_CONTEXT,
          request.headers as Record<string, unknown>,
          textMapGetter,
        );
        const span = this.tracer.startSpan(
          "service_2.double_number",
          undefined,
          parentContext,
        );
        const startedAt = performance.now();
        this.messageCount += 1;

        try {
          span.setAttribute("service_2.message.value", request.body.value);
          const number = Number.parseInt(request.body.value, 10);
          if (Number.isNaN(number)) {
            const error = new Error("value must be numeric");
            this.errorCounter.add(1);
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            this.logger.exception(
              `invalid number received: ${request.body.value}`,
              error,
            );
            response.status(400).json({ detail: "value must be numeric" });
            return;
          }

          const doubled = number * 2;
          const traceId = traceIdHex(span);
          this.doubledCounter.add(1);
          this.durationHistogram.record(performance.now() - startedAt);
          this.logger.info(`doubled ${number} to ${doubled}`);
          response.json({
            value: request.body.value,
            doubled,
            traceId,
          } satisfies DoubleResponse);
        } catch (error) {
          span.recordException(
            error instanceof Error ? error : new Error(String(error)),
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          span.end();
          this.maybeScheduleExit();
        }
      },
    );

    return app;
  }
}

export class Service1 {
  readonly app: express.Express;
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

  constructor(private readonly service2Url = DEFAULT_SERVICE_2_URL) {
    this.telemetry = new TelemetryBundle("service_1");
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
    this.app = this.createApp();
  }

  private async doubleValue(
    rawValue: string,
    index: number,
    parentContext: Context,
  ): Promise<DoubleResponse> {
    const span = this.tracer.startSpan(
      "service_1.send_number",
      undefined,
      parentContext,
    );
    span.setAttribute("message.index", index);
    span.setAttribute("message.value", rawValue);
    const spanContext = trace.setSpan(parentContext, span);
    const startedAt = performance.now();

    try {
      const headers: HeaderCarrier = {};
      propagation.inject(spanContext, headers, textMapSetter);
      const response = await fetch(`${this.service2Url}/double`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ value: rawValue } satisfies NumberRequest),
      });

      if (!response.ok) {
        throw new Error(
          `POST ${this.service2Url}/double failed with ${response.status}: ${await readResponseText(response)}`,
        );
      }

      const payload = (await response.json()) as DoubleResponse;
      span.setAttribute("service_2.trace_id", payload.traceId);
      this.sentCounter.add(1);
      this.logger.info(
        `sent value ${rawValue} and received ${payload.doubled}`,
      );
      return payload;
    } catch (error) {
      this.failureCounter.add(1);
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      this.logger.exception(`failed to send value ${rawValue}`, error);
      throw error;
    } finally {
      this.latencyHistogram.record(performance.now() - startedAt);
      span.end();
    }
  }

  async sendNumbersToService2(
    messages: readonly string[] = DEFAULT_MESSAGES,
  ): Promise<WorkflowResult> {
    const results: DoubleResponse[] = [];
    const failures: FailureRecord[] = [];

    for (const [index, rawValue] of messages.entries()) {
      try {
        const payload = await this.doubleValue(
          rawValue,
          index + 1,
          ROOT_CONTEXT,
        );
        results.push(payload);
      } catch (error) {
        failures.push({
          value: rawValue,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { results, failures };
  }

  private createApp(): express.Express {
    const app = express();

    app.get("/health", (_request, response) => {
      response.json({ status: "ok", service: "service_1" });
    });

    app.post("/run", async (_request, response: ExpressResponse) => {
      response.json(await this.sendNumbersToService2());
    });

    return app;
  }

  async runService1Demo(
    messages: readonly string[] = DEFAULT_MESSAGES,
  ): Promise<WorkflowResult> {
    return await this.sendNumbersToService2(messages);
  }
}

export async function runService1Demo(
  service2Url: string,
  messages: readonly string[] = DEFAULT_MESSAGES,
): Promise<WorkflowResult> {
  return await new Service1(service2Url).runService1Demo(messages);
}

async function main(): Promise<void> {
  const serviceArgIndex = process.argv.indexOf("--service");
  const service =
    serviceArgIndex >= 0 && process.argv[serviceArgIndex + 1] === "service_2"
      ? "service_2"
      : "service_1";
  const portArgIndex = process.argv.indexOf("--port");

  if (service === "service_2") {
    const service2 = new Service2();
    service2.autoExit = true;
    const port =
      portArgIndex >= 0
        ? Number.parseInt(process.argv[portArgIndex + 1] ?? "", 10)
        : Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
    service2.app.listen(port, "127.0.0.1", () => {
      console.log(`Listening on http://127.0.0.1:${port}`);
    });
    return;
  }

  const service1 = new Service1();
  const result = await service1.runService1Demo();
  console.log(JSON.stringify(result, null, 2));
  await service1.telemetry.forceFlush();
  await service1.telemetry.shutdown();
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
