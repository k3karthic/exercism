import { strict as assert } from "node:assert";
import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { RabbitMQContainer } from "@testcontainers/rabbitmq";
import { test } from "vitest";

import { DEFAULT_FAILED_MESSAGES_FILE, runDemo } from "./app.js";

test("runDemo processes numbers and logs failed messages", async () => {
  const container = await new RabbitMQContainer(
    "rabbitmq:3.9.10-management-alpine",
  ).start();

  try {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "rabbitmq-"));
    const failedMessagesPath = path.join(
      tempDirectory,
      DEFAULT_FAILED_MESSAGES_FILE,
    );

    const doubledNumbers = await runDemo(container.getAmqpUrl(), {
      failedMessagesPath,
    });

    assert.deepEqual(doubledNumbers, [2, 4, 6, 8]);
    assert.match(
      await readFile(failedMessagesPath, "utf8"),
      /^delivery_tag=\d+ value="oops" error=Error: invalid literal for int\(\) with base 10: 'oops'$/m,
    );
  } finally {
    await container.stop();
  }
}, 120_000);
