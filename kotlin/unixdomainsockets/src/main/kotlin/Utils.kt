package com.github.k3karthic.unixdomainsockets

import java.nio.ByteBuffer
import java.nio.channels.SocketChannel

class Utils {
    companion object {
        fun readBytes(clientChannel: SocketChannel): ByteBuffer {
            val responseBuffer = ByteBuffer.allocate(1024)
            while (true) {
                val n = clientChannel.read(responseBuffer)
                if (n < 0) {
                    break
                }
            }

            return responseBuffer
        }

        fun readData(clientChannel: SocketChannel): Pair<String, Int> {
            val buffer = readBytes(clientChannel)
            buffer.flip()

            val response = Charsets.UTF_8.decode(buffer).toString()
            val parts = response.split(":")
            val resId = parts[0]
            val resNum = parts[1].toInt()

            return Pair(resId, resNum)
        }
    }
}
