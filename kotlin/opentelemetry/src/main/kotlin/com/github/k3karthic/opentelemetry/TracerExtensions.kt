package com.github.k3karthic.opentelemetry

import io.opentelemetry.kotlin.context.Context
import io.opentelemetry.kotlin.tracing.Span
import io.opentelemetry.kotlin.tracing.Tracer

fun Tracer.startSpanForCaller(parentContext: Context? = null): Span {
    val caller =
        Thread.currentThread().stackTrace.first {
            it.methodName != "getStackTrace" && !it.methodName.startsWith("startSpanForCaller")
        }
    val spanName = "${caller.methodName}()"

    return if (parentContext != null) {
        startSpan(spanName, parentContext)
    } else {
        startSpan(spanName)
    }
}
