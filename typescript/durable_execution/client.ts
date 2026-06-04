import { Client, Connection } from "@temporalio/client";
import { fileURLToPath } from "node:url";

import { TASK_QUEUE, TEMPORAL_TARGET } from "./activities.js";
import { doublerWorkflow } from "./workflows.js";

export async function runWorkflow(client: Client): Promise<number> {
  return await client.workflow.execute(doublerWorkflow, {
    workflowId: "durable-execution-workflow",
    taskQueue: TASK_QUEUE,
  });
}

async function main(): Promise<void> {
  const connection = await Connection.connect({
    address: TEMPORAL_TARGET,
  });

  try {
    const client = new Client({ connection });
    const result = await runWorkflow(client);
    console.log(result);
  } finally {
    await connection.close();
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main();
}
