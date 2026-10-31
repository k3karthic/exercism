package com.github.k3karthic.testcontainers

import com.redis.testcontainers.RedisContainer
import io.lettuce.core.ExperimentalLettuceCoroutinesApi
import io.lettuce.core.RedisClient
import io.lettuce.core.api.StatefulRedisConnection
import io.lettuce.core.api.coroutines
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import kotlin.test.Test
import kotlin.test.assertEquals

@Testcontainers
internal class MainTest {
    companion object {
        private const val REDIS_PORT = 6379

        @Container
        @JvmField
        val redisContainer = RedisContainer("redis:7-alpine")

        private lateinit var redisClient: RedisClient
        private lateinit var connection: StatefulRedisConnection<String, String>

        @BeforeAll
        @JvmStatic
        fun setUpAll() {
            val host = redisContainer.host
            val port = redisContainer.getMappedPort(REDIS_PORT)

            redisClient = RedisClient.create("redis://$host:$port")
            connection = redisClient.connect()
        }

        @AfterAll
        @JvmStatic
        fun tearDownAll() {
            if (::connection.isInitialized) connection.close()
            if (::redisClient.isInitialized) redisClient.shutdown()
        }
    }

    @Test
    fun testSynchronous() {
        val syncCommands = connection.sync()

        syncCommands.set("hello", "world")
        val result = syncCommands.get("hello")

        assertEquals("world", result)
    }

    @OptIn(ExperimentalLettuceCoroutinesApi::class)
    @Test
    fun testAsychronous() =
        runTest {
            val asyncCommands = connection.coroutines()

            asyncCommands.set("hello", "world")
            val result = asyncCommands.get("hello")

            assertEquals("world", result)
        }
}
