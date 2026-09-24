from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from functools import cached_property
from typing import Any, Sequence

from opentelemetry import metrics, trace
from opentelemetry.sdk._logs import LoggingHandler, LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode

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


def _trace_id_hex(span: trace.Span) -> str:
    return f"{span.get_span_context().trace_id:032x}"


def _normalize_endpoint(endpoint: str) -> str:
    return endpoint.removeprefix("http://").removeprefix("https://")


def _build_resource(service_name: str) -> Resource:
    return Resource.create(
        {"service.name": service_name, "service.namespace": "python"}
    )


def configure_telemetry(service_name: str) -> TelemetryBundle:
    endpoint = _normalize_endpoint(
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "127.0.0.1:4317")
    )
    resource = _build_resource(service_name)

    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        BatchSpanProcessor(trace_exporter_class(endpoint))
    )
    metric_reader = PeriodicExportingMetricReader(metric_exporter_class(endpoint))
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(log_exporter_class(endpoint))
    )
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


def _service_logger(service_name: str) -> logging.Logger:
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


def _service_tracer(service_name: str) -> trace.Tracer:
    return trace.get_tracer(f"otel.{service_name}")


def _service_meter(service_name: str) -> metrics.Meter:
    return metrics.get_meter(f"otel.{service_name}")


def _tracer_for(service_name: str, telemetry: TelemetryBundle) -> trace.Tracer:
    if telemetry.tracer_provider is None:
        return _service_tracer(service_name)
    return telemetry.tracer_provider.get_tracer(f"otel.{service_name}")


def _meter_for(service_name: str, telemetry: TelemetryBundle) -> metrics.Meter:
    if telemetry.meter_provider is None:
        return _service_meter(service_name)
    return telemetry.meter_provider.get_meter(f"otel.{service_name}")


class Service2:
    def __init__(self) -> None:
        self.logger = _service_logger("service_2")
        self.telemetry = TelemetryBundle()

    @cached_property
    def tracer(self) -> trace.Tracer:
        return _tracer_for("service_2", self.telemetry)

    @cached_property
    def meter(self) -> metrics.Meter:
        return _meter_for("service_2", self.telemetry)

    @cached_property
    def doubled_counter(self):
        return self.meter.create_counter("otel_numbers_doubled_total")

    @cached_property
    def error_counter(self):
        return self.meter.create_counter("otel_number_errors_total")

    @cached_property
    def duration_histogram(self):
        return self.meter.create_histogram("otel_double_duration_ms")

    async def double_number(self, value: str) -> DoubleResult:
        start = time.perf_counter()
        with self.tracer.start_as_current_span("service_2.double_number") as span:
            span.set_attribute("service_2.message.value", value)
            try:
                number = int(value)
            except ValueError as error:
                self.error_counter.add(1)
                span.record_exception(error)
                span.set_status(Status(StatusCode.ERROR, str(error)))
                self.logger.exception("invalid number received: %s", value)
                raise ValueError("value must be numeric") from error

            doubled = number * 2
            self.doubled_counter.add(1)
            self.duration_histogram.record((time.perf_counter() - start) * 1000)
            self.logger.info("doubled %s to %s", number, doubled)
            return {
                "value": value,
                "doubled": doubled,
                "trace_id": _trace_id_hex(span),
            }


class Service1:
    def __init__(self, service_2: Service2) -> None:
        self.service_2 = service_2
        self.logger = _service_logger("service_1")
        self.telemetry = TelemetryBundle()

    @cached_property
    def tracer(self) -> trace.Tracer:
        return _tracer_for("service_1", self.telemetry)

    @cached_property
    def meter(self) -> metrics.Meter:
        return _meter_for("service_1", self.telemetry)

    @cached_property
    def sent_counter(self):
        return self.meter.create_counter("otel_messages_sent_total")

    @cached_property
    def failure_counter(self):
        return self.meter.create_counter("otel_messages_failed_total")

    @cached_property
    def latency_histogram(self):
        return self.meter.create_histogram("otel_message_round_trip_ms")

    async def send_numbers_to_service_2(
        self,
        messages: Sequence[str] = DEFAULT_MESSAGES,
    ) -> WorkflowResult:
        results: list[DoubleResult] = []
        failures: list[FailureResult] = []

        for index, raw_value in enumerate(messages, start=1):
            start = time.perf_counter()
            with self.tracer.start_as_current_span("service_1.send_number") as span:
                span.set_attribute("message.index", index)
                span.set_attribute("message.value", raw_value)

                try:
                    payload = await self.service_2.double_number(raw_value)
                    span.set_attribute("service_2.trace_id", payload["trace_id"])
                    self.sent_counter.add(1)
                    results.append(payload)
                    self.logger.info(
                        "sent value %s and received %s",
                        raw_value,
                        payload["doubled"],
                    )
                except ValueError as error:
                    self.failure_counter.add(1)
                    failures.append({"value": raw_value, "error": str(error)})
                    span.record_exception(error)
                    span.set_status(Status(StatusCode.ERROR, str(error)))
                    self.logger.exception("failed to send value %s", raw_value)
                finally:
                    self.latency_histogram.record((time.perf_counter() - start) * 1000)

        return {"results": results, "failures": failures}


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenTelemetry two-service sample")
    parser.add_argument(
        "--messages",
        nargs="*",
        default=DEFAULT_MESSAGES,
        help="Values sent from service_1 to service_2",
    )
    args = parser.parse_args()

    service_2 = Service2()
    service_1 = Service1(service_2)
    service_1.telemetry = configure_telemetry("service_1")
    service_2.telemetry = configure_telemetry("service_2")
    try:
        result = asyncio.run(service_1.send_numbers_to_service_2(args.messages))
        print(json.dumps(result, indent=2))
    finally:
        service_1.telemetry.force_flush()
        service_2.telemetry.force_flush()
        service_1.telemetry.shutdown()
        service_2.telemetry.shutdown()


if __name__ == "__main__":
    main()
