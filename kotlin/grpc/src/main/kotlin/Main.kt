package com.github.k3karthic.grpc

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.main
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.types.int
import doubler_service.DoubleRequest
import doubler_service.DoubleResponse
import doubler_service.Doubler
import doubler_service.invoke
import kotlinx.coroutines.runBlocking
import kotlinx.rpc.grpc.client.GrpcClient
import kotlinx.rpc.grpc.server.GrpcServer
import kotlinx.rpc.registerService
import kotlinx.rpc.withService
import java.util.UUID
import kotlin.random.Random

suspend fun runDemo(
    port: Int,
    num: Int? = null,
): DoubleResponse {
    val doublerService = DoublerImpl()

    val server =
        GrpcServer(port) {
            services {
                registerService<Doubler> { doublerService }
            }
        }

    doublerService.start()
    server.start()

    val inputNumber = num ?: Random.nextInt(0, 100)

    val client =
        GrpcClient("localhost", port) {
            credentials = plaintext()
        }

    val recognizer = client.withService<Doubler>()

    val result =
        recognizer.Double(
            DoubleRequest.Companion {
                requestId = UUID.randomUUID().toString()
                number = inputNumber
            },
        )

    doublerService.stop()
    server.shutdownNow()

    return result
}

class GRPCCommand : CliktCommand() {
    val port: Int by option().int().default(50051)

    override fun run() {
        runBlocking {
            runDemo(port)
        }
    }
}

fun main(args: Array<String>) = GRPCCommand().main(args)
