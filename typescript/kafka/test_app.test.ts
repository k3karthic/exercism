import { strict as assert } from "node:assert";
import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { KafkaContainer } from "@testcontainers/kafka";
import { test } from "vitest";

import { DEFAULT_FAILED_MESSAGES_FILE, runDemo } from "./app.js";

const KAFKA_BROKER_PORT = 9093;

test("runDemo processes numbers and logs failed messages", async () => {
  const kafkaContainer = await new KafkaContainer(
    "confluentinc/cp-kafka:7.2.2",
  ).start();

  try {
    const bootstrapServers = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(KAFKA_BROKER_PORT)}`;
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "kafka-"));
    const failedMessagesPath = path.join(
      tempDirectory,
      DEFAULT_FAILED_MESSAGES_FILE,
    );

    const doubledNumbers = await runDemo(bootstrapServers, {
      failedMessagesPath,
    });

    assert.deepEqual(doubledNumbers, [2, 4, 6, 8]);
    assert.match(
      await readFile(failedMessagesPath, "utf8"),
      /^offset=2 value="oops" error=Error: invalid literal for int\(\) with base 10: "oops"$/m,
    );
  } finally {
    await kafkaContainer.stop();
  }
}, 120_000);
