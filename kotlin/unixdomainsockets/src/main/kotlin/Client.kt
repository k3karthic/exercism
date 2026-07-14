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

    val p: Path = Path.of(socketPath)
    val address: UnixDomainSocketAddress? = UnixDomainSocketAddress.of(p)

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
            clientChannel.write(ByteBuffer.wrap(message.toByteArray(Charsets.UTF_8)))
            clientChannel.shutdownOutput()

            val (resId, resNum) = Utils.readData(clientChannel)

            if (resId != reqId) {
                throw Exception("resID doesn't match reqId: $resId")
            }

            return resNum
        }
    }
}
