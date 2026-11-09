import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { worker } from "./async.js";

describe("worker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("processes all input items and doubles them", async () => {
    const input = [1, 2, 3];
    const output: number[] = [];

    const promise = worker(input, output, 1);
    await vi.advanceTimersByTimeAsync(1000 * 3);
    await promise;

    expect(input).toEqual([]);
    expect(output).toEqual([2, 4, 6]);
  });

  test("handles empty input", async () => {
    const input: number[] = [];
    const output: number[] = [];

    await worker(input, output, 1);

    expect(output).toEqual([]);
  });

  test("processes a single item", async () => {
    const input = [5];
    const output: number[] = [];

    const promise = worker(input, output, 1);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(output).toEqual([10]);
  });

  test("multiple workers share input and output concurrently", async () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output: number[] = [];

    const promises = [worker(input, output, 1), worker(input, output, 2), worker(input, output, 3)];

    await vi.advanceTimersByTimeAsync(1000 * 6);
    await Promise.all(promises);

    expect(input).toEqual([]);
    expect(output.length).toBe(6);
    expect(output.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10, 12]);
  });

  test("logs processing messages", async () => {
    const input = [7];
    const output: number[] = [];

    const promise = worker(input, output, 42);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Worker 42"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("processing 7"));
  });
});
