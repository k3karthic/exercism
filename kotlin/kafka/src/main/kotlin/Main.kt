package com.github.k3karthic.kafka

import org.apache.kafka.clients.CommonClientConfigs
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.clients.producer.ProducerRecord
import java.lang.Integer.parseInt
import java.util.Properties
import kotlin.io.path.Path
import kotlin.io.path.appendText
import kotlin.io.path.createFile
import kotlin.io.path.createParentDirectories
import kotlin.io.path.exists

const val TOPIC = "sample-numbers"
const val FAILED_MESSAGES_PATH = "./failed_messages.txt"

fun getProps(bootstrapServers: String): Properties {
    val props = Properties()
    props[CommonClientConfigs.BOOTSTRAP_SERVERS_CONFIG] = bootstrapServers
    props[ProducerConfig.LINGER_MS_CONFIG] = 1
    props[ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG] = "org.apache.kafka.common.serialization.StringSerializer"
    props[ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG] = "org.apache.kafka.common.serialization.StringSerializer"
    props[ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG] = "org.apache.kafka.common.serialization.StringDeserializer"
    props[ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG] = "org.apache.kafka.common.serialization.StringDeserializer"
    props[ConsumerConfig.MAX_POLL_RECORDS_CONFIG] = 1
    props[ConsumerConfig.GROUP_ID_CONFIG] = "test"
    props[ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG] = "false"
    props[ConsumerConfig.AUTO_OFFSET_RESET_CONFIG] = "earliest"

    return props
}

class Producer(
    bootstrapServers: String,
) {
    val producer: KafkaProducer<String?, String?> = KafkaProducer<String?, String?>(getProps(bootstrapServers))

    fun sendMessages(
        topic: String,
        messages: List<String>,
    ) {
        producer.use {
            for (message in messages) {
                producer.send(ProducerRecord(topic, message))
            }
        }
    }
}

class Consumer(
    bootstrapServers: String,
) {
    val consumer: KafkaConsumer<String?, String?> = KafkaConsumer<String?, String?>(getProps(bootstrapServers))

    fun consumeAndDoubleMessages(
        topic: String,
        failedMessagesPath: String,
        expectedMessages: Int,
    ): MutableList<Int> {
        val doubledNumbers = mutableListOf<Int>()
        var seenMessages = 0

        consumer.use { consumer ->
            consumer.subscribe(listOf(topic))
            while (true) {
                val records = consumer.poll(java.time.Duration.ofSeconds(1))
                for (record in records) {
                    val numStr = record.value()

                    try {
                        val num = parseInt(numStr)
                        doubledNumbers.add(num * num)
                    } catch (e: NumberFormatException) {
                        appendFailedMessages(failedMessagesPath, record)
                    }

                    consumer.commitSync()
                    seenMessages += 1
                }

                if (seenMessages >= expectedMessages) {
                    break
                }
            }
        }

        return doubledNumbers
    }

    fun appendFailedMessages(
        failedMessagesPath: String,
        record: ConsumerRecord<String?, String?>,
    ) {
        val path = Path(failedMessagesPath)
        path.createParentDirectories()

        if (!path.exists()) {
            path.createFile()
        }

        path.appendText("offset=${record.offset()} value=${record.value()}\n")
    }
}

fun runDemo(bootstrapServers: String): MutableList<Int> {
    val producer = Producer(bootstrapServers)
    val consumer = Consumer(bootstrapServers)

    println("Producing messages")
    producer.sendMessages(TOPIC, listOf("1", "2a", "3"))

    println("Consuming messages")
    return consumer.consumeAndDoubleMessages(TOPIC, FAILED_MESSAGES_PATH, 3)
}

fun main() {
    val bootstrapServers = "localhost:9092"

    val result = runDemo(bootstrapServers)
    println(result)
}
