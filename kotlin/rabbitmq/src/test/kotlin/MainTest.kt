package com.github.k3karthic.rabbitmq

import org.junit.jupiter.api.BeforeAll
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.rabbitmq.RabbitMQContainer
import kotlin.test.Test
import kotlin.test.assertEquals

@Testcontainers
internal class MainTest {
    companion object {
        @Container
        @JvmField
        val rabbitMQContainer = RabbitMQContainer("rabbitmq:4.0-management-alpine")

        private lateinit var amqpUrl: String

        @BeforeAll
        @JvmStatic
        fun beforeAll() {
            amqpUrl = rabbitMQContainer.amqpUrl
        }
    }

    @Test
    fun testDemo() {
        val result = runDemo(amqpUrl)

        assertEquals(result.size, 2)
        assertEquals(result[0], 1)
        assertEquals(result[1], 9)
    }
}
