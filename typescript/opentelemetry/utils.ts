import type { Span } from "@opentelemetry/api";
import { SeverityNumber, type Logger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, NodeTracerProvider, type SpanProcessor } from "@opentelemetry/sdk-trace-node";

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

export class ServiceLogger {
  private readonly logger: Logger;

  constructor(
    private readonly serviceName: string,
    loggerProvider: LoggerProvider,
  ) {
    this.logger = loggerProvider.getLogger(serviceName);
  }

  info(message: string): void {
    // Use stderr (not stdout) for human-readable logs so a subprocess's
    // stdout can carry only the JSON result payload; mirrors Python's
    // logging.StreamHandler, which defaults to stderr.
    console.error(`${this.serviceName}: ${message}`);
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

export class TelemetryBundle {
  readonly tracerProvider: NodeTracerProvider;
  readonly meterProvider: MeterProvider;
  readonly loggerProvider: LoggerProvider;

  constructor(serviceName: string, extraSpanProcessors: readonly SpanProcessor[] = []) {
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
        ? [...extraSpanProcessors, new BatchSpanProcessor(new OTLPTraceExporter({ url: normalizedEndpoint }))]
        : [...extraSpanProcessors],
    });
    // Registers this provider as the global tracer provider, plus an
    // AsyncLocalStorage-based context manager and the default W3C Trace
    // Context propagator. A full `NodeSDK()` setup (or
    // `@opentelemetry/auto-instrumentations-node`) would normally do this
    // for you; it's explicit here since this sample builds its providers by
    // hand. Without it, `context.active()` never carries the active span,
    // and `propagation.inject`/`extract` have nothing to work with.
    this.tracerProvider.register();
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
      processors: hasEndpoint ? [new BatchLogRecordProcessor(new OTLPLogExporter({ url: normalizedEndpoint }))] : [],
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
    await Promise.all([this.tracerProvider.shutdown(), this.meterProvider.shutdown(), this.loggerProvider.shutdown()]);
  }
}

export function traceIdHex(span: Span): string {
  return span.spanContext().traceId;
}
