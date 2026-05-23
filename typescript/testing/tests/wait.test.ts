import { describe, expect, test, vi } from "vitest";
import { waitForLabel } from "../src/wait.js";

describe("waitForLabel", () => {
  test("resolves after the requested delay", async () => {
    vi.useFakeTimers();

    const promise = waitForLabel("upload", 250);
    await vi.advanceTimersByTimeAsync(250);

    await expect(promise).resolves.toBe("upload ready");
    vi.useRealTimers();
  });
});
