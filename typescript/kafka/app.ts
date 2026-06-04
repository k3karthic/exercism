import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { KafkaJS } from "@confluentinc/kafka-javascript";

const { Kafka } = KafkaJS;

export const DEFAULT_TOPIC = "sample-numbers";
export const DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"];
export const DEFAULT_FAILED_MESSAGES_FILE = "failed_messages.txt";
export const DEFAULT_GROUP_ID = "sample-number-consumer";
const DEFAULT_BOOTSTRAP_SERVERS = "localhost:9092";

function createKafkaClient(bootstrapServers: string) {
  return new Kafka({
    kafkaJS: {
      brokers: [bootstrapServers],
    },
  });
}

async function appendFailedMessage(
  failedMessagesPath: string,
  rawValue: string,
  error: Error,
  offset: string,
): Promise<void> {
  await mkdir(path.dirname(failedMessagesPath), { recursive: true });
  await appendFile(
    failedMessagesPath,
    `offset=${offset} value=${JSON.stringify(rawValue)} error=${error}\n`,
    "utf8",
  );
}

class KafkaProducer {
  private readonly producer;

  constructor(bootstrapServers: string) {
    const kafka = createKafkaClient(bootstrapServers);
    this.producer = kafka.producer();
  }

  async sendMessages(topic: string, messages: Iterable<string>): Promise<void> {
    await this.producer.connect();
    try {
      await this.producer.send({
        topic,
        messages: [...messages].map((message) => ({ value: message })),
      });
      await this.producer.flush();
    } finally {
      await this.producer.disconnect();
    }
  }
}

class KafkaConsumer {
  private readonly consumer;

  constructor(bootstrapServers: string) {
    const kafka = createKafkaClient(bootstrapServers);
    this.consumer = kafka.consumer({
      kafkaJS: {
        groupId: DEFAULT_GROUP_ID,
        fromBeginning: true,
        autoCommit: false,
      },
    });
  }

  async consumeAndDoubleMessages(
    topic: string,
    failedMessagesPath: string,
    expectedMessages: number,
  ): Promise<number[]> {
    const doubledNumbers: number[] = [];
    let seenMessages = 0;
    let resolveCompletion: (() => void) | undefined;
    const completed = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });

    await this.consumer.connect();
    try {
      await this.consumer.subscribe({ topics: [topic] });
      void this.consumer.run({
        eachMessage: async ({ message, topic, partition }) => {
          seenMessages += 1;

          const rawValue = message.value?.toString("utf8") ?? "";
          const numericValue = Number.parseInt(rawValue, 10);

          if (Number.isNaN(numericValue)) {
            await appendFailedMessage(
              failedMessagesPath,
              rawValue,
              new Error(
                `invalid literal for int() with base 10: ${JSON.stringify(rawValue)}`,
              ),
              message.offset,
            );
          } else {
            doubledNumbers.push(numericValue * 2);
          }

          await this.consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (BigInt(message.offset) + 1n).toString(),
            },
          ]);

          if (seenMessages >= expectedMessages) {
            resolveCompletion?.();
          }
        },
      });

      await completed;
    } finally {
      await this.consumer.disconnect();
    }

    return doubledNumbers;
  }
}

export async function runDemo(
  bootstrapServers: string,
  options: {
    topic?: string;
    failedMessagesPath?: string;
  } = {},
): Promise<number[]> {
  const topic = options.topic ?? DEFAULT_TOPIC;
  const failedMessagesPath =
    options.failedMessagesPath ?? DEFAULT_FAILED_MESSAGES_FILE;

  const producer = new KafkaProducer(bootstrapServers);
  const consumer = new KafkaConsumer(bootstrapServers);

  await producer.sendMessages(topic, DEFAULT_MESSAGES);
  return await consumer.consumeAndDoubleMessages(
    topic,
    failedMessagesPath,
    DEFAULT_MESSAGES.length,
  );
}

async function main(): Promise<void> {
  const doubledNumbers = await runDemo(DEFAULT_BOOTSTRAP_SERVERS, {
    topic: DEFAULT_TOPIC,
    failedMessagesPath: DEFAULT_FAILED_MESSAGES_FILE,
  });
  console.log(doubledNumbers);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
