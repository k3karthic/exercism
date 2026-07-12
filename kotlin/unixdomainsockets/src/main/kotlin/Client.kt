package com.github.k3karthic.unixdomainsockets

import java.net.StandardProtocolFamily
import java.net.UnixDomainSocketAddress
import java.nio.ByteBuffer
import java.nio.channels.SocketChannel
import java.nio.file.Path
import kotlin.random.Random

class Client(
    socketPath: String,
) {
    private val clientChannel: SocketChannel

    val p = Path.of(socketPath)
    val address = UnixDomainSocketAddress.of(p)

    init {
        clientChannel =
            SocketChannel.open(StandardProtocolFamily.UNIX).apply {
                connect(address)
            }
    }

    fun start(
        num: Int,
        defaultReqId: Int? = null,
    ): Int {
        clientChannel.use { clientChannel ->
            val reqId = defaultReqId ?: Random.nextInt(0, Int.MAX_VALUE).toString()

            val message = "$reqId:$num"
            val buffer = ByteBuffer.wrap(message.toByteArray(Charsets.UTF_8))
            clientChannel.write(buffer)

            val responseBuffer = ByteBuffer.allocate(1024)
            clientChannel.read(responseBuffer)
            responseBuffer.flip()

            val response = Charsets.UTF_8.decode(responseBuffer).toString()
            val parts = response.split(":")
            val resId = parts[0]
            val resNum = parts[1].toInt()

            if (resId != reqId) {
                throw Exception("resID doesn't match reqId: $resId")
            }

            return resNum
        }
    }
}
