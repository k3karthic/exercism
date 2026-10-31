package com.github.k3karthic.concurrency

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.Channel.Factory.UNLIMITED
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlin.time.Duration.Companion.milliseconds

suspend fun worker(
    inputChannel: Channel<Int>,
    outputChannel: Channel<Pair<Int, Int>>,
) {
    while (true) {
        val x = inputChannel.receive()
        delay(1.milliseconds)
        outputChannel.send(x to x * 2)
    }
}

fun runDemo(dispatcher: CoroutineDispatcher = Dispatchers.Default): IntArray {
    val numMessages = 3
    val scope = CoroutineScope(dispatcher)

    val inputChannel = Channel<Int>(UNLIMITED)
    val outputChannel = Channel<Pair<Int, Int>>(UNLIMITED)

    runBlocking {
        for (x in 1..numMessages) {
            inputChannel.send(x)
        }
    }

    repeat(numMessages) {
        scope.launch { worker(inputChannel, outputChannel) }
    }

    val results = IntArray(numMessages)
    runBlocking {
        repeat(numMessages) {
            val (input, output) = outputChannel.receive()
            results[input - 1] = output
        }
    }

    scope.cancel()

    return results
}

fun main() {
    val results = runDemo()
    println("results: ${results.contentToString()}")
}
