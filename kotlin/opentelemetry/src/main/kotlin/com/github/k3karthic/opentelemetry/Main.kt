package com.github.k3karthic.opentelemetry

fun main() {
    @Suppress("UnsafeCallOnNullableType")
    val otel = OtelConfig.getConfig(Service1::class.simpleName!!)
    val s1 = Service1(otel)

    s1.run()

    exitAfterExport()
}
