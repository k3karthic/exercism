import * as fs from "node:fs";
import * as net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

type ProcessedRequest = {
  result: number;
  timestamp: number;
};

export class AsyncIdempotentServer {
  public readonly socketPath: string;
  public readonly processedRequests = new Map<string, ProcessedRequest>();
  private server: net.Server | undefined;
  private cleanupTimer: NodeJS.Timeout | undefined;
  private isRunning = false;

  public constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  private currentUid(): number {
    const uid = process.getuid?.();
    if (uid === undefined) {
      throw new Error("Unix domain sockets require a POSIX environment.");
    }

    return uid;
  }

  public _secureCleanupExisting(): void {
    if (!fs.existsSync(this.socketPath)) {
      return;
    }

    const fileStat = fs.statSync(this.socketPath);
    if (fileStat.uid !== this.currentUid()) {
      throw new PermissionError(
        `Security Alert: Socket path '${this.socketPath}' is owned by another user.`,
      );
    }

    fs.rmSync(this.socketPath);
  }

  public async start(): Promise<void> {
    this._secureCleanupExisting();

    this.server = net.createServer({ allowHalfOpen: true }, (socket) => {
      void this._handleClient(socket);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.socketPath, () => {
        fs.chmodSync(this.socketPath, 0o600);
        console.log(
          `[SECURITY] Set safe permissions (0600) on ${this.socketPath}`,
        );
        console.log(`Async Server listening on path: ${this.socketPath}...`);
        this.isRunning = true;
        this.cleanupTimer = setInterval(() => {
          void this._cleanupLoop();
        }, 30_000);
        this.cleanupTimer.unref();
        resolve();
      });
    });

    await once(this.server, "close");
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    await new Promise<void>((resolve) => {
      if (this.server === undefined) {
        resolve();
        return;
      }

      this.server.close(() => resolve());
    });

    if (fs.existsSync(this.socketPath)) {
      fs.rmSync(this.socketPath);
    }

    console.log("Server shut down cleanly.");
  }

  public async _handleClient(socket: net.Socket): Promise<void> {
    try {
      const data = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const onData = (chunk: Buffer): void => {
          chunks.push(chunk);
        };
        const onEnd = (): void => {
          cleanup();
          resolve(Buffer.concat(chunks));
        };
        const onError = (error: Error): void => {
          cleanup();
          reject(error);
        };
        const cleanup = (): void => {
          socket.off("data", onData);
          socket.off("end", onEnd);
          socket.off("error", onError);
        };

        socket.on("data", onData);
        socket.once("end", onEnd);
        socket.once("error", onError);
      });

      if (data.length === 0) {
        return;
      }

      const payload = data.toString("utf8");
      const [reqId, numStr] = payload.split(":", 2);
      if (reqId === undefined || numStr === undefined) {
        throw new Error("Invalid request payload.");
      }

      const number = Number.parseInt(numStr, 10);

      if (Number.isNaN(number)) {
        throw new Error("Invalid request payload.");
      }

      let result: number;
      if (this.processedRequests.has(reqId)) {
        console.log(`[CACHE HIT] Returning cached result for Request ${reqId}`);
        result = this.processedRequests.get(reqId)?.result ?? 0;
      } else {
        console.log(`[NEW REQ] Processing Request ${reqId}: Double ${number}`);
        result = number * 2;
        this.processedRequests.set(reqId, {
          result,
          timestamp: Date.now(),
        });
      }
      const responsePayload = `${reqId}:${result}`;
      const onResponseError = (error: Error): void => {
        console.log(`Error sending response: ${error}`);
        socket.destroy();
      };

      socket.once("error", onResponseError);
      socket.write(responsePayload, () => {
        socket.end(() => {
          socket.off("error", onResponseError);
        });
      });
    } catch (error) {
      console.log(`Error handling request: ${error}`);
      socket.destroy();
    }
  }

  private async _cleanupLoop(): Promise<void> {
    while (this.isRunning) {
      await sleep(30_000);

      const now = Date.now();
      const expired: string[] = [];
      for (const [reqId, request] of this.processedRequests) {
        if (now - request.timestamp > 300_000) {
          expired.push(reqId);
        }
      }

      for (const reqId of expired) {
        this.processedRequests.delete(reqId);
      }

      if (expired.length > 0) {
        console.log(
          `[CLEANUP] Purged ${expired.length} expired requests from memory.`,
        );
      }
    }
  }
}

export class PermissionError extends Error {}

function parseSocketPath(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-s" || value === "--socket") {
      const socketPath = argv[index + 1];
      if (socketPath === undefined) {
        throw new Error("Missing value for --socket.");
      }

      return socketPath;
    }
  }

  throw new Error("The --socket argument is required.");
}

async function main(): Promise<void> {
  const socketPath = parseSocketPath(process.argv.slice(2));
  const serverInstance = new AsyncIdempotentServer(socketPath);

  process.once("SIGINT", () => {
    void serverInstance.stop().then(() => {
      process.exit(0);
    });
  });

  try {
    await serverInstance.start();
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Execution terminated: ${error}`);
    }
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main();
}
