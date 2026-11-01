package com.github.k3karthic.opentelemetry

import kotlinx.serialization.Serializable

@Serializable
data class ServiceResult(
    val error: String?,
    val output: Double?,
)
