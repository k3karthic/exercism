import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  createDoublerClient,
  type DoubleRequest,
  type DoubleResponse,
  type DoublerClient,
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
  createClient: (value: string) => DoublerClient = createDoublerClient,
): Promise<number> {
  const requestId = reqId ?? randomUUID().slice(0, 8);
  const request = {
    request_id: requestId,
    number,
  } satisfies DoubleRequest;

  const client = createClient(target);
  try {
    console.log("Connecting to server...");
    const response = await requestDouble(client, request);

    console.log(
      `Success! [Validated ID: ${response.request_id}] Result: ${response.result}`,
    );
    return response.result;
  } finally {
    client.close();
  }
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
