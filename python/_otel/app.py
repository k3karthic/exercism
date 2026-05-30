from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from functools import cached_property
from typing import Any, AsyncGenerator, Callable, Sequence

import httpx
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from opentelemetry import metrics, trace
from opentelemetry.propagate import extract, inject
from opentelemetry.sdk._logs import LoggingHandler, LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel, Field, ValidationError

DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"]
MESSAGE_COUNT_LIMIT = len(DEFAULT_MESSAGES)
DEFAULT_SERVICE_2_URL = "http://127.0.0.1:8002"
DEFAULT_TIMEOUT = 5.0


class NumberRequest(BaseModel):
    value: str = Field(..., description="A numeric string or an invalid sample")


class DoubleResponse(BaseModel):
    value: str
    doubled: int
    trace_id: str


class FailureRecord(BaseModel):
    value: str
    error: str


class WorkflowResult(BaseModel):
    results: list[DoubleResponse]
    failures: list[FailureRecord]


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
    trace.set_tracer_provider(tracer_provider)

    metric_reader = PeriodicExportingMetricReader(metric_exporter_class(endpoint))
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

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


class Service2:
    def __init__(self) -> None:
        self.logger = _service_logger("service_2")
        self.telemetry = TelemetryBundle()
        self.auto_exit = False
        self.message_count = 0
        self.app = self._create_app()

    @cached_property
    def tracer(self) -> trace.Tracer:
        return _service_tracer("service_2")

    @cached_property
    def meter(self) -> metrics.Meter:
        return _service_meter("service_2")

    @cached_property
    def doubled_counter(self):
        return self.meter.create_counter("otel_numbers_doubled_total")

    @cached_property
    def error_counter(self):
        return self.meter.create_counter("otel_number_errors_total")

    @cached_property
    def duration_histogram(self):
        return self.meter.create_histogram("otel_double_duration_ms")

    def _request_exit(self) -> None:
        os.kill(os.getpid(), signal.SIGTERM)

    async def _flush_then_exit(self) -> None:
        provider = trace.get_tracer_provider()
        force_flush = getattr(provider, "force_flush", None)
        if callable(force_flush):
            force_flush()
        meter_provider = metrics.get_meter_provider()
        force_flush = getattr(meter_provider, "force_flush", None)
        if callable(force_flush):
            force_flush()
        self.telemetry.force_flush()
        await asyncio.sleep(0.25)
        self._request_exit()

    def _maybe_schedule_exit(self) -> None:
        if self.auto_exit and self.message_count == MESSAGE_COUNT_LIMIT:
            asyncio.create_task(self._flush_then_exit())

    def _create_app(self) -> FastAPI:
        @asynccontextmanager
        async def lifespan(app: FastAPI):  # noqa: ARG001
            self.telemetry = configure_telemetry("service_2")
            try:
                yield
            finally:
                self.telemetry.force_flush()
                self.telemetry.shutdown()

        app = FastAPI(title="service_2", lifespan=lifespan)

        @app.get("/health")
        async def health() -> dict[str, str]:
            return {"status": "ok", "service": "service_2"}

        @app.post("/double", response_model=DoubleResponse)
        async def double_number(
            request: Request, payload: NumberRequest
        ) -> DoubleResponse:
            parent_context = extract(dict(request.headers))
            start = time.perf_counter()
            self.message_count += 1
            try:
                with self.tracer.start_as_current_span(
                    "service_2.double_number",
                    context=parent_context,
                ) as span:
                    span.set_attribute("service_2.message.value", payload.value)
                    try:
                        number = int(payload.value)
                    except ValueError as error:
                        self.error_counter.add(1)
                        span.record_exception(error)
                        span.set_status(Status(StatusCode.ERROR, str(error)))
                        self.logger.exception(
                            "invalid number received: %s", payload.value
                        )
                        raise HTTPException(
                            status_code=400, detail="value must be numeric"
                        ) from error

                    doubled = number * 2
                    trace_id = _trace_id_hex(span)
                    self.doubled_counter.add(1)
                    self.duration_histogram.record((time.perf_counter() - start) * 1000)
                    self.logger.info("doubled %s to %s", number, doubled)
                    return DoubleResponse(
                        value=payload.value, doubled=doubled, trace_id=trace_id
                    )
            finally:
                self._maybe_schedule_exit()

        return app


class Service1:
    def __init__(
        self,
        *,
        service_2_dependency: Callable[[], AsyncGenerator[httpx.AsyncClient, None]]
        | None = None,
    ) -> None:
        self.service_2_dependency = (
            service_2_dependency
            or self._make_service_2_client_dependency(DEFAULT_SERVICE_2_URL)
        )
        self.logger = _service_logger("service_1")
        self.telemetry = TelemetryBundle()
        self.app = self._create_app()

    @cached_property
    def tracer(self) -> trace.Tracer:
        return _service_tracer("service_1")

    @cached_property
    def meter(self) -> metrics.Meter:
        return _service_meter("service_1")

    @cached_property
    def sent_counter(self):
        return self.meter.create_counter("otel_messages_sent_total")

    @cached_property
    def failure_counter(self):
        return self.meter.create_counter("otel_messages_failed_total")

    @cached_property
    def latency_histogram(self):
        return self.meter.create_histogram("otel_message_round_trip_ms")

    def _make_service_2_client_dependency(
        self, service_2_url: str
    ) -> Callable[[], AsyncGenerator[httpx.AsyncClient, None]]:
        async def dependency() -> AsyncGenerator[httpx.AsyncClient, None]:
            async with httpx.AsyncClient(
                base_url=service_2_url, timeout=DEFAULT_TIMEOUT
            ) as client:
                yield client

        return dependency

    async def send_numbers_to_service_2(
        self,
        client: httpx.AsyncClient,
        messages: Sequence[str] = DEFAULT_MESSAGES,
    ) -> WorkflowResult:
        results: list[DoubleResponse] = []
        failures: list[FailureRecord] = []

        for index, raw_value in enumerate(messages, start=1):
            start = time.perf_counter()
            with self.tracer.start_as_current_span("service_1.send_number") as span:
                span.set_attribute("message.index", index)
                span.set_attribute("message.value", raw_value)

                headers: dict[str, str] = {}
                inject(headers)
                try:
                    response = await client.post(
                        "/double", json={"value": raw_value}, headers=headers
                    )
                    response.raise_for_status()
                    payload = DoubleResponse.model_validate(response.json())
                    span.set_attribute("service_2.trace_id", payload.trace_id)
                    self.sent_counter.add(1)
                    results.append(payload)
                    self.logger.info(
                        "sent value %s and received %s", raw_value, payload.doubled
                    )
                except (httpx.HTTPError, ValidationError, ValueError) as error:
                    self.failure_counter.add(1)
                    failures.append(FailureRecord(value=raw_value, error=str(error)))
                    span.record_exception(error)
                    span.set_status(Status(StatusCode.ERROR, str(error)))
                    self.logger.exception("failed to send value %s", raw_value)
                finally:
                    self.latency_histogram.record((time.perf_counter() - start) * 1000)

        return WorkflowResult(results=results, failures=failures)

    def _create_app(self) -> FastAPI:
        @asynccontextmanager
        async def lifespan(app: FastAPI):  # noqa: ARG001
            self.telemetry = configure_telemetry("service_1")
            try:
                yield
            finally:
                self.telemetry.force_flush()
                self.telemetry.shutdown()

        app = FastAPI(title="service_1", lifespan=lifespan)

        @app.get("/health")
        async def health() -> dict[str, str]:
            return {"status": "ok", "service": "service_1"}

        @app.post("/run", response_model=WorkflowResult)
        async def run_demo(
            client: httpx.AsyncClient = Depends(self.service_2_dependency),
        ) -> WorkflowResult:
            return await self.send_numbers_to_service_2(client)

        return app

    async def run_service_1_demo(
        self, service_2_url: str, messages: Sequence[str]
    ) -> WorkflowResult:
        async with httpx.AsyncClient(
            base_url=service_2_url, timeout=DEFAULT_TIMEOUT
        ) as client:
            return await self.send_numbers_to_service_2(client, messages)


service_2 = Service2()
service_1 = Service1()
service_2_app = service_2.app
service_1_app = service_1.app


async def run_service_1_demo(
    service_2_url: str, messages: Sequence[str]
) -> WorkflowResult:
    return await service_1.run_service_1_demo(service_2_url, messages)


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenTelemetry two-service sample")
    parser.add_argument(
        "--service",
        choices=["service_1", "service_2"],
        default="service_1",
        help="Which service to run",
    )
    parser.add_argument(
        "--service-2-url",
        default=os.getenv("SERVICE_2_URL", DEFAULT_SERVICE_2_URL),
        help="Base URL for service_2",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Server host for service_2")
    parser.add_argument(
        "--port", default=8002, type=int, help="Server port for service_2"
    )
    parser.add_argument(
        "--messages",
        nargs="*",
        default=DEFAULT_MESSAGES,
        help="Values sent from service_1 to service_2",
    )
    args = parser.parse_args()

    if args.service == "service_2":
        service_2.auto_exit = True
        uvicorn.run(service_2.app, host=args.host, port=args.port, reload=False)
        return

    telemetry = configure_telemetry("service_1")
    try:
        result = asyncio.run(run_service_1_demo(args.service_2_url, args.messages))
        print(result.model_dump_json(indent=2))
        telemetry.force_flush()
    finally:
        telemetry.shutdown()


if __name__ == "__main__":
    main()
