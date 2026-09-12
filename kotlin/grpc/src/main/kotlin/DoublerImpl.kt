package com.github.k3karthic.grpc

import doubler_service.DoubleRequest
import doubler_service.DoubleResponse
import doubler_service.Doubler
import doubler_service.invoke
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.time.Clock
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

data class ProcessedRequest(
    val result: Int,
    val timestampInSeconds: Long,
)

class DoublerImpl : Doubler {
    val externalScope: CoroutineScope = CoroutineScope(Dispatchers.Default)
    val requestsCache: MutableMap<String, ProcessedRequest> = mutableMapOf()

    private var job: Job? = null

    fun start() {
        if (job?.isActive == true) {
            return
        }

        job =
            externalScope.launch {
                clearRequestsCache(isActive)
            }
    }

    fun saveRequest(
        requestId: String,
        result: Int,
    ) {
        requestsCache[requestId] = ProcessedRequest(result, Clock.System.now().epochSeconds)
    }

    suspend fun stop() {
        job?.cancelAndJoin()
        job = null
    }

    override suspend fun Double(message: DoubleRequest): DoubleResponse {
        delay(1.milliseconds)
        val x =
            DoubleResponse.Companion.invoke {
                requestId = message.requestId
                result = message.number * 2
            }

        saveRequest(x.requestId, x.result)

        return x
    }

    suspend fun clearRequestsCache(
        isActive: Boolean,
        ttlSeconds: Long = 300,
    ) {
        while (isActive) {
            delay(5.seconds)
            requestsCache.forEach { (id, x) ->
                if (Clock.System.now().epochSeconds - x.timestampInSeconds > ttlSeconds) {
                    requestsCache.remove(id)
                }
            }
        }
    }
}
