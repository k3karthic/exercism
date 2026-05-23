import { strict as assert } from "node:assert";

import { RedisContainer } from "@testcontainers/redis";
import { createClient } from "redis";

async function main(): Promise<void> {
  const container = await new RedisContainer("redis:5.0.3-alpine").start();
  const client = createClient({
    url: container.getConnectionUrl(),
  });

  try {
    await client.connect();
    await client.set("foo", "bar");
    const value = await client.get("foo");
    assert.equal(value, "bar");
    console.log(value);
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
    await container.stop();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
