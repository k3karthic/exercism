package com.github.k3karthic.opentelemetry

fun main() {
    val otel = OtelConfig.getConfig(Service1::class.simpleName!!)
    val s1 = Service1(otel)

    s1.run()

    // Hack until the kotlin sdk releases a new version with shutdown methods
    Thread.sleep(2000)
}
