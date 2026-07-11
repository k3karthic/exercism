package com.github.k3karthic.concurrency

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.Channel.Factory.UNLIMITED
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.concurrent.Executors
import kotlin.time.Duration.Companion.milliseconds

suspend fun worker(
    inputChannel: Channel<Int>,
    outputChannel: Channel<Int>,
) {
    while (true) {
        val x = inputChannel.receive()
        delay(1.milliseconds)
        outputChannel.send(x * 2)
    }
}

fun runDemo(): Array<Int> {
    val dispatcher = Executors.newFixedThreadPool(1).asCoroutineDispatcher()
    val scope = CoroutineScope(dispatcher)

    val inputChannel = Channel<Int>(UNLIMITED)
    val outputChannel = Channel<Int>(UNLIMITED)

    runBlocking {
        for (x in 1..3) {
            inputChannel.send(x)
        }
    }

    for (i in 1..3) {
        scope.launch { worker(inputChannel, outputChannel) }
    }

    val results: Array<Int> = Array(3) { 0 }
    runBlocking {
        for (i in 0..2) {
            results[i] = outputChannel.receive()
        }
    }

    scope.cancel()
    dispatcher.close()

    return results
}

fun main() {
    val results = runDemo()
    println("results: ${results.contentToString()}")
}
