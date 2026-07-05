package com.github.k3karthic.kafka

import org.junit.jupiter.api.BeforeAll
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.kafka.KafkaContainer
import kotlin.test.Test
import kotlin.test.assertEquals

@Testcontainers
internal class MainTest {
    companion object {
        @Container
        @JvmField
        val kafkaContainer = KafkaContainer("apache/kafka-native:3.8.0")

        private lateinit var bootstrapServers: String

        @BeforeAll
        @JvmStatic
        fun beforeAll() {
            bootstrapServers = kafkaContainer.bootstrapServers
        }
    }

    @Test
    fun testDemo() {
        val result = runDemo(bootstrapServers)

        assertEquals(result.size, 2)
        assertEquals(result[0], 1)
        assertEquals(result[1], 9)
    }
}
