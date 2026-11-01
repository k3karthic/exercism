package com.github.k3karthic.opentelemetry

import io.opentelemetry.kotlin.NoopOpenTelemetry
import io.opentelemetry.kotlin.OpenTelemetry
import io.opentelemetry.kotlin.context.Context
import io.opentelemetry.kotlin.context.asImplicitContext
import java.io.File

data class ProcessResult(
    val exitCode: Int,
    val output: String,
)

class Service1(
    otel: OpenTelemetry = NoopOpenTelemetry,
) {
    val logger = otel.loggerProvider.getLogger(Service1::class.java.name)
    val tracer = otel.tracerProvider.getTracer(Service1::class.java.name)

    val propagator = otel.propagator
    val contextFactory = otel.context

    fun injectContext(
        carrier: MutableMap<String, String>,
        context: Context = contextFactory.implicit(),
    ) {
        propagator.inject(context, carrier) { map, key, value ->
            map?.put(key, value)
        }
    }

    inline fun <reified T> runClassAsSubprocess(args: List<String> = emptyList()): ProcessResult {
        val javaHome = System.getProperty("java.home")
        val javaBin = "$javaHome${File.separator}bin${File.separator}java"
        val classpath = System.getProperty("java.class.path")

        // Automatically extracts the fully qualified class name from the type parameter
        val className =
            T::class.qualifiedName
                ?: throw IllegalArgumentException("Class must have a qualified name (cannot be local or anonymous)")

        val command = mutableListOf(javaBin, "-cp", classpath, className)
        command.addAll(args)

        val processBuilder = ProcessBuilder(command).redirectErrorStream(true)

        val carrier = mutableMapOf<String, String>()
        injectContext(carrier)

        val env = processBuilder.environment()
        for ((key, value) in carrier) {
            env["OTEL_PROP_$key"] = value
        }

        val process = processBuilder.start()

        val output = process.inputStream.bufferedReader().use { it.readText() }
        val exitCode = process.waitFor()

        return ProcessResult(exitCode, output)
    }

    fun run() {
        val s = tracer.startSpanForCaller()
        val ctx = contextFactory.implicit().storeSpan(s)

        ctx.asImplicitContext {
            val result = runClassAsSubprocess<Service2>(listOf("param1", "param2"))
            println("Service2 output:\n${result.output}")
            check(result.exitCode == 0) { "Service2 exited with code ${result.exitCode}" }
            logger.emit("Subprocess finished with exit code: $result.exitCode")

            s.end()
        }
    }
}
