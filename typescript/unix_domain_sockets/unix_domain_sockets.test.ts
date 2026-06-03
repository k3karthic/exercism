import { EventEmitter } from "node:events";
import type * as net from "node:net";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import * as client from "./client.js";
import * as server from "./server.js";

class FakeWriter extends EventEmitter {
  public readonly buffer: Buffer[] = [];
  public ended = false;
  public destroyed = false;

  public write(data: string | Buffer): boolean {
    this.buffer.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return true;
  }

  public end(): this {
    this.ended = true;
    return this;
  }

  public destroy(): this {
    this.destroyed = true;
    return this;
  }
}

class FakeClientSocket extends EventEmitter {
  public sent = "";
  public destroyed = false;

  public constructor() {
    super();
    queueMicrotask(() => {
      this.emit("connect");
    });
  }

  public end(data?: string | Buffer): this {
    if (data !== undefined) {
      this.sent = Buffer.isBuffer(data) ? data.toString("utf8") : data;
    }

    queueMicrotask(() => {
      this.emit("data", Buffer.from("req-7:14"));
    });

    return this;
  }

  public destroy(): this {
    this.destroyed = true;
    return this;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("secure cleanup removes a socket path owned by the current user", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "uds-"));
  const socketPath = join(tempDir, "service.sock");
  writeFileSync(socketPath, "placeholder");

  const service = new server.AsyncIdempotentServer(socketPath);
  service._secureCleanupExisting();

  expect(existsSync(socketPath)).toBe(false);
});

test("handle client caches the computed result", async () => {
  const service = new server.AsyncIdempotentServer("/tmp/unused.sock");

  const firstSocket = new FakeWriter();
  const firstPromise = service._handleClient(
    firstSocket as unknown as net.Socket,
  );
  firstSocket.emit("data", Buffer.from("req-1:5"));
  await firstPromise;

  const secondSocket = new FakeWriter();
  const secondPromise = service._handleClient(
    secondSocket as unknown as net.Socket,
  );
  secondSocket.emit("data", Buffer.from("req-1:99"));
  await secondPromise;

  expect(
    firstSocket.buffer.map((chunk) => chunk.toString("utf8")).join(""),
  ).toBe("req-1:10");
  expect(
    secondSocket.buffer.map((chunk) => chunk.toString("utf8")).join(""),
  ).toBe("req-1:10");
  expect(service.processedRequests.size).toBe(1);
});

test("verify socket permissions rejects loose permissions", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "uds-"));
  const socketPath = join(tempDir, "service.sock");
  writeFileSync(socketPath, "placeholder");
  chmodSync(socketPath, 0o644);

  expect(() => client.verifySocketPermissions(socketPath)).toThrow("too open");
});

test("send request with retry returns the numeric result", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "uds-"));
  const socketPath = join(tempDir, "service.sock");
  writeFileSync(socketPath, "placeholder");
  chmodSync(socketPath, 0o600);

  const fakeSocket = new FakeClientSocket();
  const result = await client.sendRequestWithRetry(
    socketPath,
    7,
    "req-7",
    1,
    0.5,
    () => fakeSocket as never,
  );

  expect(result).toBe(14);
  expect(fakeSocket.sent).toBe("req-7:7");
  expect(fakeSocket.destroyed).toBe(true);
});
