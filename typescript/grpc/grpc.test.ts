import { afterEach, expect, test, vi } from "vitest";

import * as client from "./client.js";
import { type DoubleRequest, type DoubleResponse } from "./grpc_support.js";
import { DoublerService } from "./server.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function callDouble(
  service: DoublerService,
  request: DoubleRequest,
): Promise<DoubleResponse> {
  return new Promise<DoubleResponse>((resolve, reject) => {
    service.Double({ request } as never, (error, response) => {
      if (error !== null) {
        reject(error);
        return;
      }

      if (response === null || response === undefined) {
        reject(new Error("Missing response"));
        return;
      }

      resolve(response);
    });
  });
}

test("double caches the computed result", async () => {
  const service = new DoublerService();

  const first = await callDouble(service, {
    request_id: "abc123",
    number: 21,
  });
  const second = await callDouble(service, {
    request_id: "abc123",
    number: 99,
  });

  expect(first.result).toBe(42);
  expect(second.result).toBe(42);
  expect(service.processedRequests.size).toBe(1);
});

test("purgeExpiredRequests removes old entries", () => {
  const service = new DoublerService();
  service.processedRequests.set("expired", { result: 2, timestamp: 0 });
  service.processedRequests.set("fresh", { result: 4, timestamp: 95_000 });

  const removed = service.purgeExpiredRequests(10, () => 100_000);

  expect(removed).toBe(1);
  expect(service.processedRequests.has("expired")).toBe(false);
  expect(service.processedRequests.has("fresh")).toBe(true);
});

test("sendRequestWithRetry returns the doubled result", async () => {
  class StubClient {
    public calls = 0;

    public Double(
      request: DoubleRequest,
      callback: (error: Error | null, response?: DoubleResponse) => void,
    ): void {
      this.calls += 1;
      callback(null, {
        request_id: request.request_id,
        result: request.number * 2,
      });
    }

    public close(): void {}
  }

  const stub = new StubClient();

  const result = await client.sendRequestWithRetry(
    "localhost:50051",
    7,
    "req-1",
    () => stub as never,
  );

  expect(result).toBe(14);
  expect(stub.calls).toBe(1);
});

test("sendRequestWithRetry rejects mismatched request ids", async () => {
  class StubClient {
    public calls = 0;

    public Double(
      request: DoubleRequest,
      callback: (error: Error | null, response?: DoubleResponse) => void,
    ): void {
      this.calls += 1;
      callback(null, {
        request_id: "wrong-id",
        result: request.number * 2,
      });
    }

    public close(): void {}
  }

  const stub = new StubClient();

  await expect(
    client.sendRequestWithRetry(
      "localhost:50051",
      7,
      "req-2",
      () => stub as never,
    ),
  ).rejects.toThrow("Request ID mismatch");

  expect(stub.calls).toBe(1);
});
