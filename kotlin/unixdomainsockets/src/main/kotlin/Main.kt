package com.github.k3karthic.unixdomainsockets

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.main
import com.github.ajalt.clikt.parameters.arguments.argument
import java.util.concurrent.Executors
import kotlin.random.Random

data class DemoResponse(
    val input: Int,
    val output: Int,
)

fun runDemo(socketPath: String): DemoResponse {
    val executor = Executors.newFixedThreadPool(2)

    val server = Server(socketPath)
    executor.submit {
        server.start()
    }
    executor.submit {
        server.startTtlTask()
    }

    Thread.sleep(2000)

    val num = Random.nextInt(0, 100)
    val result = Client(socketPath).start(num)

    executor.shutdownNow()

    return DemoResponse(num, result)
}

class UDS : CliktCommand() {
    val socketPath by argument()

    override fun run() {
        val response = runDemo(socketPath)
        println("Double of num: ${response.input} is ${response.output}")
    }
}

fun main(args: Array<String>) = UDS().main(args)
