package com.github.k3karthic.opentelemetry

import io.opentelemetry.kotlin.context.Context
import io.opentelemetry.kotlin.context.asImplicitContext
import io.opentelemetry.kotlin.propagation.TextMapGetter

object Service2 {
    val otel = OtelConfig.getConfig(Service2::class.simpleName!!)

    val logger = otel.loggerProvider.getLogger(Service2::class.java.name)
    val tracer = otel.tracerProvider.getTracer(Service2::class.java.name)

    val propagator = otel.propagator
    val contextFactory = otel.context

    fun extractContext(carrier: Map<String, String>): Context {
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

        return propagator.extract(contextFactory.implicit(), carrier, getter)
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
            logger.emit("yo")

            s.end()
        }

        // Hack until the kotlin sdk releases a new version with shutdown methods
        Thread.sleep(2000)
    }
}
