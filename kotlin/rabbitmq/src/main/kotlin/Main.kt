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

const val QUEUE = "sample-numbers"
const val FAILED_MESSAGES_PATH = "./failed_messages.txt"

fun getAmqpEnvironment(amqpUrl: String): Environment {
    val environment =
        AmqpEnvironmentBuilder()
            .connectionSettings()
            .uri(amqpUrl)
            .environmentBuilder()
            .build()

    return environment
}

fun getConnection(environment: Environment): Connection = environment.connectionBuilder().build()

class Producer(
    amqpUrl: String,
    queue: String,
) {
    val connection = getConnection(getAmqpEnvironment(amqpUrl))
    val publisher = connection.publisherBuilder().queue(queue).build()!!

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
    amqpUrl: String,
) {
    val connection = getConnection(getAmqpEnvironment(amqpUrl))

    fun consumeAndDoubleMessages(
        queue: String,
        failedMessagesPath: String,
        expectedMessages: Int,
    ): MutableList<Int> {
        val doubledNumbers = mutableListOf<Int>()

        val latch = CountDownLatch(expectedMessages)

        val consumer =
            connection
                .consumerBuilder()
                .queue(queue)
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

fun runDemo(amqpUrl: String): MutableList<Int> {
    val connection = getConnection(getAmqpEnvironment(amqpUrl))
    val management = connection.management()
    val queue = management.queue(QUEUE)
    queue.declare()

    val producer = Producer(amqpUrl, QUEUE)
    val consumer = Consumer(amqpUrl)

    println("Producing messages")
    producer.sendMessages(listOf("1", "2a", "3"))

    println("Consuming messages")
    val result = consumer.consumeAndDoubleMessages(QUEUE, FAILED_MESSAGES_PATH, 3)

    management.close()
    connection.close()

    return result
}

fun main() {
    val amqpUrl = "amqp://guest:guest@localhost:5672/%2f"

    val result = runDemo(amqpUrl)
    println(result)

    exitProcess(0)
}
