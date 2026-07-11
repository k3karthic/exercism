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

fun runDemo(): Array<Int> {
    val inputQueue: ConcurrentLinkedQueue<Int> = ConcurrentLinkedQueue()
    val outputQueue: ConcurrentLinkedQueue<Int> = ConcurrentLinkedQueue()

    for (x in 1..3) {
        inputQueue.add(x)
    }

    val executor = Executors.newFixedThreadPool(3)
    for (i in 1..3) {
        executor.submit(worker(inputQueue, outputQueue))
    }

    val results: Array<Int> = Array(3) { 0 }
    for (i in 0..2) {
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
