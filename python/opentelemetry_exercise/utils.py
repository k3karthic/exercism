from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from opentelemetry import metrics, trace
from opentelemetry.sdk._logs import LoggingHandler, LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"]
DoubleResult = dict[str, int | str]
FailureResult = dict[str, str]
WorkflowResult = dict[str, list[DoubleResult] | list[FailureResult]]


@dataclass(slots=True)
class TelemetryBundle:
    logger_provider: LoggerProvider | None = None
    meter_provider: MeterProvider | None = None
    tracer_provider: TracerProvider | None = None

    def force_flush(self) -> None:
        if self.tracer_provider is not None:
            self.tracer_provider.force_flush()
        if self.meter_provider is not None:
            self.meter_provider.force_flush()
        if self.logger_provider is not None:
            self.logger_provider.force_flush()

    def shutdown(self) -> None:
        if self.tracer_provider is not None:
            self.tracer_provider.shutdown()
        if self.meter_provider is not None:
            self.meter_provider.shutdown()
        if self.logger_provider is not None:
            self.logger_provider.shutdown()


def trace_id_hex(span: trace.Span) -> str:
    return f"{span.get_span_context().trace_id:032x}"


def _normalize_endpoint(endpoint: str) -> str:
    return endpoint.removeprefix("http://").removeprefix("https://")


def _build_resource(service_name: str) -> Resource:
    return Resource.create({"service.name": service_name, "service.namespace": "python"})


def configure_telemetry(service_name: str) -> TelemetryBundle:
    raw_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    resource = _build_resource(service_name)

    tracer_provider = TracerProvider(resource=resource)
    meter_readers: list[PeriodicExportingMetricReader] = []
    logger_provider = LoggerProvider(resource=resource)

    # Only wire up real OTLP exporters when a collector endpoint is
    # configured, so running the sample/tests without a collector doesn't
    # try to dial 127.0.0.1:4317 by default.
    if raw_endpoint:
        endpoint = _normalize_endpoint(raw_endpoint)
        tracer_provider.add_span_processor(
            BatchSpanProcessor(trace_exporter_class(endpoint))
        )
        meter_readers.append(
            PeriodicExportingMetricReader(metric_exporter_class(endpoint))
        )
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(log_exporter_class(endpoint))
        )

    meter_provider = MeterProvider(resource=resource, metric_readers=meter_readers)

    service_logger = logging.getLogger(service_name)
    service_logger.setLevel(logging.INFO)
    if not any(
        isinstance(handler, LoggingHandler) for handler in service_logger.handlers
    ):
        service_logger.addHandler(
            LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        )
    return TelemetryBundle(
        logger_provider=logger_provider,
        meter_provider=meter_provider,
        tracer_provider=tracer_provider,
    )


def trace_exporter_class(endpoint: str) -> Any:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

    return OTLPSpanExporter(endpoint=endpoint, insecure=True)


def metric_exporter_class(endpoint: str) -> Any:
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
        OTLPMetricExporter,
    )

    return OTLPMetricExporter(endpoint=endpoint, insecure=True)


def log_exporter_class(endpoint: str) -> Any:
    from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

    return OTLPLogExporter(endpoint=endpoint, insecure=True)


def service_logger(service_name: str) -> logging.Logger:
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
        logger.addHandler(handler)
    logger.propagate = False
    return logger


def tracer_for(service_name: str, telemetry: TelemetryBundle) -> trace.Tracer:
    if telemetry.tracer_provider is None:
        return trace.get_tracer(f"otel.{service_name}")
    return telemetry.tracer_provider.get_tracer(f"otel.{service_name}")


def meter_for(service_name: str, telemetry: TelemetryBundle) -> metrics.Meter:
    if telemetry.meter_provider is None:
        return metrics.get_meter(f"otel.{service_name}")
    return telemetry.meter_provider.get_meter(f"otel.{service_name}")
