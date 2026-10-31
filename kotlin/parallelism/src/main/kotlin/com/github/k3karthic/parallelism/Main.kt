package com.github.k3karthic.parallelism

import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors

fun worker(
    inputQueue: ConcurrentLinkedQueue<Int>,
    outputQueue: ConcurrentLinkedQueue<Int>,
) = Runnable {
    while (true) {
        val x = inputQueue.poll() ?: break
        Thread.sleep(1)
        outputQueue.add(x * x)
    }
}

fun runDemo(): IntArray {
    val inputQueue: ConcurrentLinkedQueue<Int> = ConcurrentLinkedQueue()
    val outputQueue: ConcurrentLinkedQueue<Int> = ConcurrentLinkedQueue()

    val numMessages = 3

    for (x in 1..numMessages) {
        inputQueue.add(x)
    }

    val executor = Executors.newFixedThreadPool(numMessages)
    repeat(numMessages) {
        executor.submit(worker(inputQueue, outputQueue))
    }

    val results = IntArray(numMessages)
    for (i in 0..<numMessages) {
        while (true) {
            val x = outputQueue.poll()
            if (x != null) {
                results[i] = x
                break
            }
            Thread.onSpinWait()
        }
    }

    executor.shutdown()

    return results
}

fun main() {
    val results = runDemo()
    println("results: ${results.contentToString()}")
}
