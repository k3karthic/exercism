package com.github.k3karthic.opentelemetry

import io.opentelemetry.kotlin.OpenTelemetry
import io.opentelemetry.kotlin.createOpenTelemetry
import io.opentelemetry.kotlin.logging.export.otlpHttpLogRecordExporter
import io.opentelemetry.kotlin.logging.export.simpleLogRecordProcessor
import io.opentelemetry.kotlin.tracing.export.otlpHttpSpanExporter
import io.opentelemetry.kotlin.tracing.export.simpleSpanProcessor
import kotlin.system.exitProcess

object OtelConfig {
    val url: String = System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

    fun getConfig(serviceName: String): OpenTelemetry =
        createOpenTelemetry {
            resource {
                resource(mapOf("service.name" to serviceName))
            }
            tracerProvider {
                export {
                    // use batchSpanProcessor after sdk shutdown hook is available
                    simpleSpanProcessor(
                        otlpHttpSpanExporter {
                            endpoint = url
                        },
                    )
                }
            }
            loggerProvider {
                export {
                    // use batchLogRecordProcessor after sdk shutdown hook is available
                    simpleLogRecordProcessor(
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

// Hack to wait for otel export and shutdown, replace with actual sdk shutdown once available in latest version
fun exitAfterExport(graceMs: Long = 2000) {
    Thread.sleep(graceMs)
    exitProcess(0)
}
