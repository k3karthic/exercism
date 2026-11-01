package com.github.k3karthic.opentelemetry

import io.opentelemetry.kotlin.NoopOpenTelemetry
import io.opentelemetry.kotlin.OpenTelemetry
import io.opentelemetry.kotlin.context.Context
import io.opentelemetry.kotlin.context.asImplicitContext
import io.opentelemetry.kotlin.propagation.TextMapGetter
import kotlinx.serialization.json.Json

object Service2 {
    @Suppress("UnsafeCallOnNullableType")
    val otel: OpenTelemetry =
        if (System.getenv("OTEL_NOOP") == "true") {
            NoopOpenTelemetry
        } else {
            OtelConfig.getConfig(Service2::class.simpleName!!)
        }

    // TODO: add metrics after support added to sdk
    @Suppress("ForbiddenComment")
    val logger = otel.loggerProvider.getLogger(Service2::class.java.name)
    val tracer = otel.tracerProvider.getTracer(Service2::class.java.name)

    val propagator = otel.propagator
    val contextFactory = otel.context

    fun extractContext(c: Map<String, String>): Context {
        val getter =
            object : TextMapGetter<Map<String, String>> {
                override fun keys(carrier: Map<String, String>): Collection<String> = carrier.keys

                override fun get(
                    carrier: Map<String, String>?,
                    key: String,
                ): String? = carrier?.get(key)

                override fun getAll(
                    carrier: Map<String, String>?,
                    key: String,
                ): List<String> {
                    // Return a list containing the value if present, otherwise an empty list
                    val value = carrier?.get(key)
                    return if (value != null) listOf(value) else emptyList()
                }
            }

        return propagator.extract(contextFactory.implicit(), c, getter)
    }

    @JvmStatic
    fun main(args: Array<String>) {
        val extractedContext =
            extractContext(
                System
                    .getenv()
                    .filterKeys { it.startsWith("OTEL_PROP_") }
                    .mapKeys { it.key.substringAfter("OTEL_PROP_") },
            )

        val s = tracer.startSpanForCaller(extractedContext)
        val ctx = contextFactory.implicit().storeSpan(s)

        ctx.asImplicitContext {
            try {
                val num = args[0].toDouble()
                logger.emit("Got num $num")
                println(Json.encodeToString(ServiceResult(error = null, output = num * num)))
            } catch (e: NumberFormatException) {
                println(Json.encodeToString(ServiceResult(error = "Invalid double: ${args[0]}", output = null)))
            }

            s.end()
        }

        if (System.getenv("OTEL_NOOP") != "true") {
            exitAfterExport()
        }
    }
}
