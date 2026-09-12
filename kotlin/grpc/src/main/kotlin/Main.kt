package com.github.k3karthic.grpc

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.main
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required
import com.github.ajalt.clikt.parameters.types.choice
import com.github.ajalt.clikt.parameters.types.int
import doubler_service.DoubleRequest
import doubler_service.Doubler
import doubler_service.invoke
import kotlinx.coroutines.runBlocking
import kotlinx.rpc.grpc.client.GrpcClient
import kotlinx.rpc.grpc.server.GrpcServer
import kotlinx.rpc.registerService
import kotlinx.rpc.withService
import java.util.UUID

class GRPCCommand : CliktCommand() {
    val port: Int by option().int().default(50051)
    val grpcType by option().choice("server", "client").required()

    override fun run() {
        if (grpcType == "server") {
            runBlocking {
                val doublerService = DoublerImpl()

                val server =
                    GrpcServer(port) {
                        services {
                            registerService<Doubler> { doublerService }
                        }
                    }

                doublerService.start()
                server.start()
                server.awaitTermination()

                doublerService.stop()
                server.shutdownNow()
            }
        }

        if (grpcType == "client") {
            val client =
                GrpcClient("localhost", port) {
                    credentials = plaintext()
                }

            val recognizer = client.withService<Doubler>()

            runBlocking {
                val result =
                    recognizer.Double(
                        DoubleRequest.Companion {
                            requestId = UUID.randomUUID().toString()
                            number = 3
                        },
                    )

                println(result)
            }
        }
    }
}

fun main(args: Array<String>) = GRPCCommand().main(args)
