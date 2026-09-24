import { pathToFileURL } from "node:url";

import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";
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
const SERVICE_NAMESPACE = "typescript";

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

function normalizeEndpoint(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  return `http://${endpoint}`;
}

function traceIdHex(span: Span): string {
  return span.spanContext().traceId;
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
      attributes: { "exception.message": errorMessage },
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
              exporter: new OTLPMetricExporter({ url: normalizedEndpoint }),
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
  }

  async doubleNumber(value: string): Promise<DoubleResponse> {
    const startedAt = performance.now();
    return await this.tracer.startActiveSpan(
      "service_2.double_number",
      async (span) => {
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
      },
    );
  }
}

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

  constructor(private readonly service2: Service2) {
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
            const payload = await this.service2.doubleNumber(rawValue);
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
  const service2 = new Service2();
  const service1 = new Service1(service2);
  try {
    const result = await service1.sendNumbersToService2();
    console.log(JSON.stringify(result, null, 2));
    await Promise.all([
      service1.telemetry.forceFlush(),
      service2.telemetry.forceFlush(),
    ]);
  } finally {
    await Promise.all([
      service1.telemetry.shutdown(),
      service2.telemetry.shutdown(),
    ]);
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
