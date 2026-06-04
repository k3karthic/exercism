import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";

export const DEFAULT_QUEUE = "sample-numbers";
export const DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"];
export const DEFAULT_FAILED_MESSAGES_FILE = path.join(
  "rabbitmq",
  "failed_messages.txt",
);
const DEFAULT_AMQP_URL = "amqp://guest:guest@localhost:5672";

async function closeConnection(connection: ChannelModel | null): Promise<void> {
  if (connection !== null) {
    await connection.close();
  }
}

async function closeChannel(channel: Channel | null): Promise<void> {
  if (channel !== null) {
    await channel.close();
  }
}

class RabbitMQProducer {
  private readonly amqpUrl: string;

  constructor(amqpUrl: string) {
    this.amqpUrl = amqpUrl;
  }

  async ensureQueue(queue: string): Promise<void> {
    const connection = await connect(this.amqpUrl);
    const channel = await connection.createChannel();

    try {
      await channel.assertQueue(queue, { durable: true });
    } finally {
      await closeChannel(channel);
      await closeConnection(connection);
    }
  }

  async sendMessages(
    queue: string,
    messages: readonly string[],
  ): Promise<void> {
    const connection = await connect(this.amqpUrl);
    const channel = await connection.createChannel();

    try {
      await channel.assertQueue(queue, { durable: true });
      for (const message of messages) {
        channel.sendToQueue(queue, Buffer.from(message), {
          persistent: true,
        });
      }
    } finally {
      await closeChannel(channel);
      await closeConnection(connection);
    }
  }
}

class RabbitMQConsumer {
  private readonly amqpUrl: string;

  constructor(amqpUrl: string) {
    this.amqpUrl = amqpUrl;
  }

  async consumeAndDoubleMessages(
    queue: string,
    options: { failedMessagesPath: string; expectedMessages: number },
  ): Promise<number[]> {
    const doubledNumbers: number[] = [];
    let seenMessages = 0;
    const connection = await connect(this.amqpUrl);
    const channel = await connection.createChannel();

    try {
      await channel.assertQueue(queue, { durable: true });
      await channel.prefetch(1);

      let consumerTag = "";
      let settled = false;

      const completion = new Promise<number[]>((resolve, reject) => {
        const handleMessage = async (
          message: ConsumeMessage | null,
        ): Promise<void> => {
          if (message === null || settled) {
            return;
          }

          seenMessages += 1;
          const rawValue = message.content.toString("utf8");

          try {
            const parsedNumber = Number.parseInt(rawValue, 10);
            if (!Number.isFinite(parsedNumber)) {
              throw new Error(
                `invalid literal for int() with base 10: '${rawValue}'`,
              );
            }
            doubledNumbers.push(parsedNumber * 2);
            channel.ack(message);
          } catch (error) {
            const appendedLine = `delivery_tag=${message.fields.deliveryTag} value=${JSON.stringify(rawValue)} error=${error}\n`;
            await mkdir(path.dirname(options.failedMessagesPath), {
              recursive: true,
            });
            await appendFile(options.failedMessagesPath, appendedLine, "utf8");
            channel.nack(message, false, false);
          }

          if (seenMessages >= options.expectedMessages && !settled) {
            settled = true;
            await channel.cancel(consumerTag);
            resolve(doubledNumbers);
          }
        };

        void channel
          .consume(queue, (message) => {
            void handleMessage(message).catch((error: unknown) => {
              if (!settled) {
                settled = true;
                reject(error);
              }
            });
          })
          .then((result) => {
            consumerTag = result.consumerTag;
          })
          .catch((error: unknown) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
      });

      return await completion;
    } finally {
      await closeChannel(channel);
      await closeConnection(connection);
    }
  }
}

export async function runDemo(
  amqpUrl: string,
  options: { failedMessagesPath?: string } = {},
): Promise<number[]> {
  const producer = new RabbitMQProducer(amqpUrl);
  const consumer = new RabbitMQConsumer(amqpUrl);

  await producer.ensureQueue(DEFAULT_QUEUE);
  await producer.sendMessages(DEFAULT_QUEUE, DEFAULT_MESSAGES);
  return await consumer.consumeAndDoubleMessages(DEFAULT_QUEUE, {
    failedMessagesPath:
      options.failedMessagesPath ?? DEFAULT_FAILED_MESSAGES_FILE,
    expectedMessages: DEFAULT_MESSAGES.length,
  });
}

async function main(): Promise<void> {
  const doubledNumbers = await runDemo(DEFAULT_AMQP_URL);
  console.log(doubledNumbers);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
