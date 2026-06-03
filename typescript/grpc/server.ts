import * as grpc from "@grpc/grpc-js";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  getDoublerServiceConstructor,
  type DoubleRequest,
  type DoubleResponse,
  type DoublerServiceImplementation,
  type SleepFn,
} from "./grpc_support.js";

type ProcessedRequest = {
  result: number;
  timestamp: number;
};

export class DoublerService {
  public readonly processedRequests = new Map<string, ProcessedRequest>();

  public Double: DoublerServiceImplementation["Double"] = (call, callback) => {
    const requestId = call.request.request_id;
    const cached = this.processedRequests.get(requestId);

    let result: number;
    if (cached !== undefined) {
      result = cached.result;
      console.log(
        `[CACHE HIT] Returning cached result for Request ${requestId}`,
      );
    } else {
      result = call.request.number * 2;
      this.processedRequests.set(requestId, {
        result,
        timestamp: Date.now(),
      });
      console.log(
        `[NEW REQ] Processing Request ${requestId}: Double ${call.request.number}`,
      );
    }

    callback(null, {
      request_id: requestId,
      result,
    });
  };

  public purgeExpiredRequests(
    ttlSeconds = 300,
    nowFn: () => number = () => Date.now(),
  ): number {
    const now = nowFn();
    const expired: string[] = [];

    for (const [requestId, request] of this.processedRequests) {
      if (now - request.timestamp > ttlSeconds * 1000) {
        expired.push(requestId);
      }
    }

    for (const requestId of expired) {
      this.processedRequests.delete(requestId);
    }

    if (expired.length > 0) {
      console.log(
        `[CLEANUP] Purged ${expired.length} expired requests from memory.`,
      );
    }

    return expired.length;
  }

  public async cleanupExpiredRequests(
    stopSignal: AbortSignal,
    ttlSeconds = 300,
    intervalSeconds = 30,
    sleepFn: SleepFn = sleep,
  ): Promise<void> {
    while (!stopSignal.aborted) {
      await sleepFn(intervalSeconds * 1000);
      if (stopSignal.aborted) {
        break;
      }

      this.purgeExpiredRequests(ttlSeconds);
    }
  }
}

export async function serve(address: string): Promise<void> {
  const server = new grpc.Server();
  const service = new DoublerService();
  const implementation: grpc.UntypedServiceImplementation = {
    Double: service.Double,
  };

  server.addService(getDoublerServiceConstructor().service, implementation);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (error) => {
        if (error !== null) {
          reject(error);
          return;
        }

        console.log(`gRPC server listening on ${address}...`);
        resolve();
      },
    );
  });

  const stopController = new AbortController();
  const cleanupTask = service.cleanupExpiredRequests(stopController.signal);

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => {
      console.log("\nExiting via KeyboardInterrupt...");
      stopController.abort();
      server.tryShutdown(() => resolve());
    });
  });

  await cleanupTask;
  console.log("Server shut down cleanly.");
}

function parseAddress(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-a" || value === "--address") {
      const address = argv[index + 1];
      if (address === undefined) {
        throw new Error("Missing value for --address.");
      }

      return address;
    }
  }

  return "[::]:50051";
}

async function main(): Promise<void> {
  const address = parseAddress(process.argv.slice(2));

  try {
    await serve(address);
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Execution terminated: ${error.message}`);
      return;
    }

    console.log(`Execution terminated: ${error}`);
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main();
}
