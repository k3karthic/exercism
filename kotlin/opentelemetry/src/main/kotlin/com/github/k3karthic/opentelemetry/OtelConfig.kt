package com.github.k3karthic.opentelemetry

import io.opentelemetry.kotlin.OpenTelemetry
import io.opentelemetry.kotlin.createOpenTelemetry
import io.opentelemetry.kotlin.logging.export.batchLogRecordProcessor
import io.opentelemetry.kotlin.logging.export.otlpHttpLogRecordExporter
import io.opentelemetry.kotlin.tracing.export.batchSpanProcessor
import io.opentelemetry.kotlin.tracing.export.otlpHttpSpanExporter

object OtelConfig {
    val url: String = System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

    fun getConfig(serviceName: String): OpenTelemetry =
        createOpenTelemetry {
            resource {
                resource(mapOf("service.name" to serviceName))
            }
            tracerProvider {
                export {
                    batchSpanProcessor(
                        otlpHttpSpanExporter {
                            endpoint = url
                        },
                    )
                }
            }
            loggerProvider {
                export {
                    batchLogRecordProcessor(
                        otlpHttpLogRecordExporter {
                            endpoint = url
                        },
                    )
                }
            }
            propagator {
                composite(
                    w3cTraceContext(),
                    w3cBaggage(),
                )
            }
        }
}
