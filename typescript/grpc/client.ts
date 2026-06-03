import * as grpc from "@grpc/grpc-js";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  createDoublerClient,
  type DoubleRequest,
  type DoubleResponse,
  type DoublerClient,
  type SleepFn,
  invokeDouble,
} from "./grpc_support.js";

export class IntegrityError extends Error {}

async function requestDouble(
  client: DoublerClient,
  request: DoubleRequest,
): Promise<DoubleResponse> {
  const response = await invokeDouble(client, request);

  if (response.request_id !== request.request_id) {
    throw new IntegrityError(
      `Security/Integrity Fault! Request ID mismatch. Expected '${request.request_id}', received '${response.request_id}'`,
    );
  }

  return response;
}

export async function sendRequestWithRetry(
  target: string,
  number: number,
  reqId: string | undefined = undefined,
  maxRetries = 5,
  initialBackoff = 0.5,
  createClient: (value: string) => DoublerClient = createDoublerClient,
  sleepFn: SleepFn = sleep,
): Promise<number> {
  const requestId = reqId ?? randomUUID().slice(0, 8);
  const request = {
    request_id: requestId,
    number,
  } satisfies DoubleRequest;

  let backoff = initialBackoff;
  let client: DoublerClient | undefined;

  try {
    client = createClient(target);
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        console.log(`Attempt ${attempt}: Connecting to server...`);
        const response = await requestDouble(client, request);

        console.log(
          `Success! [Validated ID: ${response.request_id}] Result: ${response.result}`,
        );
        return response.result;
      } catch (error) {
        if (error instanceof IntegrityError) {
          throw error;
        }

        console.log(`  Attempt ${attempt} failed: ${error}`);
        if (attempt === maxRetries) {
          console.log("Max retries reached. Failing.");
          throw error;
        }

        console.log(`  Retrying in ${backoff} seconds...`);
        await sleepFn(backoff * 1000);
        backoff *= 2;
      }
    }
  } finally {
    client?.close();
  }

  throw new Error("Unreachable retry loop exit.");
}

function parseNumber(value: string | undefined): number {
  if (value === undefined) {
    throw new Error("Missing value for --number.");
  }

  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: ${value}`);
  }

  return number;
}

function parseTarget(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-t" || value === "--target") {
      const target = argv[index + 1];
      if (target === undefined) {
        throw new Error("Missing value for --target.");
      }

      return target;
    }
  }

  return "localhost:50051";
}

function parseNumberArg(argv: string[]): number {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-n" || value === "--number") {
      return parseNumber(argv[index + 1]);
    }
  }

  return 55;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const target = parseTarget(argv);
  const number = parseNumberArg(argv);

  console.log("--- Running gRPC Doubler Client ---");
  try {
    await sendRequestWithRetry(target, number);
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
