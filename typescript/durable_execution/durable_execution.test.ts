import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterEach, expect, test, vi } from "vitest";

import * as durableExecution from "./activities.js";
import { TASK_QUEUE } from "./activities.js";
import { runWorkflow } from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("doubler workflow runs real activities", async () => {
  const calls: string[] = [];
  const originalGetRandomNumberActivity =
    durableExecution.getRandomNumberActivity;
  const originalDoubleNumberActivity = durableExecution.doubleNumberActivity;

  const activityImplementations = {
    async getRandomNumberActivity(): Promise<number> {
      calls.push("getRandomNumberActivity");
      return await originalGetRandomNumberActivity();
    },
    async doubleNumberActivity(number: number): Promise<number> {
      calls.push("doubleNumberActivity");
      return await originalDoubleNumberActivity(number);
    },
  };

  vi.spyOn(Math, "random").mockReturnValue(0.2);

  const testEnv = await TestWorkflowEnvironment.createLocal();
  try {
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities: activityImplementations,
    });

    const result = await worker.runUntil(runWorkflow(testEnv.client));

    expect(result).toBe(42);
    expect(calls).toEqual(["getRandomNumberActivity", "doubleNumberActivity"]);
  } finally {
    await testEnv.teardown();
  }
}, 120_000);
