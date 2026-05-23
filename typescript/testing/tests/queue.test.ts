import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { JobQueue } from "../src/jobQueue.js";

describe("JobQueue", () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  test("tracks size as jobs are added and removed", () => {
    expect(queue.size).toBe(0);
    expect(queue.enqueue("build")).toBe(1);
    expect(queue.enqueue("test")).toBe(2);
    expect(queue.next()).toBe("build");
    expect(queue.size).toBe(1);
  });

  test("returns undefined when empty", () => {
    expect(queue.next()).toBeUndefined();
  });
});
