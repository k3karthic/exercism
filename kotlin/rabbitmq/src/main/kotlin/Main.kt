package com.github.k3karthic.rabbitmq

import com.rabbitmq.client.amqp.Connection
import com.rabbitmq.client.amqp.Environment
import com.rabbitmq.client.amqp.impl.AmqpEnvironmentBuilder
import java.lang.Integer.parseInt
import java.util.concurrent.CountDownLatch
import kotlin.io.path.Path
import kotlin.io.path.appendText
import kotlin.io.path.createFile
import kotlin.io.path.createParentDirectories
import kotlin.io.path.exists
import kotlin.system.exitProcess

fun getAmqpEnvironment(bootstrapServers: String): Environment {
    val environment =
        AmqpEnvironmentBuilder()
            .connectionSettings()
            .uri(bootstrapServers)
            .environmentBuilder()
            .build()

    return environment
}

fun getConnection(environment: Environment): Connection = environment.connectionBuilder().build()

class Producer(
    bootstrapServers: String,
    topic: String,
) {
    val connection = getConnection(getAmqpEnvironment(bootstrapServers))
    val publisher = connection.publisherBuilder().queue(topic).build()!!

    fun sendMessages(messages: List<String>) {
        publisher.use {
            for (message in messages) {
                publisher.publish(publisher.message(message.toByteArray(Charsets.UTF_8))) {}
            }
        }

        publisher.close()
        connection.close()
    }
}

class Consumer(
    bootstrapServers: String,
) {
    val connection = getConnection(getAmqpEnvironment(bootstrapServers))

    fun consumeAndDoubleMessages(
        topic: String,
        failedMessagesPath: String,
        expectedMessages: Int,
    ): MutableList<Int> {
        val doubledNumbers = mutableListOf<Int>()

        val latch = CountDownLatch(expectedMessages)

        val consumer =
            connection
                .consumerBuilder()
                .queue(topic)
                .messageHandler { context, message ->
                    val numStr = message.body().toString(Charsets.UTF_8)

                    try {
                        val num = parseInt(numStr)
                        doubledNumbers.add(num * num)
                    } catch (e: NumberFormatException) {
                        appendFailedMessages(failedMessagesPath, numStr)
                    }

                    context.accept()
                    latch.countDown()
                }.build()

        latch.await()
        consumer.close()
        connection.close()

        return doubledNumbers
    }

    fun appendFailedMessages(
        failedMessagesPath: String,
        numStr: String,
    ) {
        val path = Path(failedMessagesPath)
        path.createParentDirectories()

        if (!path.exists()) {
            path.createFile()
        }

        path.appendText("value=${numStr}\n")
    }
}

fun main() {
    val bootstrapServers = "amqp://guest:guest@localhost:5672/%2f"
    val topic = "sample-numbers"
    val failedMessagesPath = "./failed_messages.txt"

    val connection = getConnection(getAmqpEnvironment(bootstrapServers))
    val management = connection.management()
    val queue = management.queue(topic)
    queue.declare()

    val producer = Producer(bootstrapServers, topic)
    val consumer = Consumer(bootstrapServers)

    println("Producing messages")
    producer.sendMessages(listOf("1", "2a", "3"))

    println("Consuming messages")
    val result = consumer.consumeAndDoubleMessages(topic, failedMessagesPath, 3)
    println(result)

    management.close()
    connection.close()

    exitProcess(0)
}
