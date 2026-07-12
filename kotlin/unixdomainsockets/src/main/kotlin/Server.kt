package com.github.k3karthic.unixdomainsockets

import java.net.StandardProtocolFamily
import java.net.UnixDomainSocketAddress
import java.nio.ByteBuffer
import java.nio.channels.ServerSocketChannel
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration
import java.time.LocalTime

data class Response(
    val result: Int,
    val ts: LocalTime,
    val requestId: String,
)

class Server(
    socketPath: String,
) {
    private var serverChannel: ServerSocketChannel

    val p = Path.of(socketPath)
    val address = UnixDomainSocketAddress.of(p)

    val m = mutableMapOf<String, Response>()

    init {
        Files.deleteIfExists(p)

        serverChannel =
            ServerSocketChannel.open(StandardProtocolFamily.UNIX).apply {
                bind(address)
            }

        Runtime.getRuntime().addShutdownHook(
            Thread {
                cleanup()
            },
        )
    }

    fun cleanup() {
        if (serverChannel.isOpen) {
            serverChannel.close()
        }

        Files.deleteIfExists(p)
    }

    fun startTtlTask() {
        while (!Thread.interrupted()) {
            val now = LocalTime.now()
            m.entries.removeIf { Duration.between(now, it.value.ts) > Duration.ofMinutes(5) }
            Thread.sleep(Duration.ofSeconds(30))
        }
    }

    fun start() {
        try {
            while (!Thread.interrupted()) {
                println("Server listening on $this.socketPath")

                val clientChannel = this.serverChannel.accept()
                val buffer = ByteBuffer.allocate(1024)

                clientChannel.read(buffer)
                buffer.flip()

                val input = Charsets.UTF_8.decode(buffer).toString()
                val parts = input.split(":")
                val requestId = parts[0]
                val number = parts[1].toInt()

                var result: Response?
                if (m.containsKey(requestId)) {
                    result = m[requestId]
                } else {
                    result = Response(requestId = requestId, result = number * number, ts = LocalTime.now())
                    m[requestId] = result
                }

                assert(result != null, { "Could not process request" })
                val response = "${result?.requestId}:${result?.result}"
                clientChannel.write(ByteBuffer.wrap(response.toByteArray(Charsets.UTF_8)))

                clientChannel.close()
            }
        } catch (e: java.nio.channels.AsynchronousCloseException) {
            println("Server socket closed, shutting down server loop.")
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            cleanup()
        }
    }
}
