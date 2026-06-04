import { fileURLToPath } from "node:url";

import { NativeConnection, Worker } from "@temporalio/worker";

import * as activities from "./activities.js";
import { TASK_QUEUE, TEMPORAL_TARGET } from "./activities.js";

export async function runWorker(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: TEMPORAL_TARGET,
  });

  try {
    const worker = await Worker.create({
      connection,
      taskQueue: TASK_QUEUE,
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities,
    });

    await worker.run();
  } finally {
    await connection.close();
  }
}

async function main(): Promise<void> {
  await runWorker();
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main();
}
