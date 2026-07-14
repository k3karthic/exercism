import * as fs from "node:fs";
import * as net from "node:net";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

export class PermissionError extends Error {}

export class IntegrityError extends Error {}

function defaultCreateSocket(socketPath: string): net.Socket {
  return net.createConnection(socketPath);
}

function currentUid(): number {
  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error("Unix domain sockets require a POSIX environment.");
  }

  return uid;
}

export function verifySocketPermissions(socketPath: string): void {
  if (!fs.existsSync(socketPath)) {
    return;
  }

  const fileStat = fs.statSync(socketPath);
  if (fileStat.uid !== currentUid()) {
    throw new PermissionError(
      "Security Violation: Socket file is owned by another user.",
    );
  }

  const unwantedPermissions =
    fileStat.mode & (fs.constants.S_IRWXG | fs.constants.S_IRWXO);
  if (unwantedPermissions !== 0) {
    throw new PermissionError(
      "Security Violation: Socket permissions are too open (must be 0600).",
    );
  }
}

async function readResponse(socket: net.Socket): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const cleanup = (): void => {
      socket.off("data", onData);
      socket.off("end", onEnd);
      socket.off("error", onError);
    };

    const onData = (chunk: Buffer | string): void => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };

    const onEnd = (): void => {
      cleanup();
      if (chunks.length === 0) {
        reject(new Error("Empty response received from server"));
        return;
      }

      resolve(Buffer.concat(chunks).toString("utf8"));
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    socket.on("data", onData);
    socket.once("end", onEnd);
    socket.once("error", onError);
  });
}

async function requestOnce(
  socketPath: string,
  payload: string,
  createSocket: (path: string) => net.Socket = defaultCreateSocket,
): Promise<string> {
  const socket = createSocket(socketPath);

  try {
    await once(socket, "connect");
    const responsePromise = readResponse(socket);
    socket.end(payload);
    return await responsePromise;
  } finally {
    socket.destroy();
  }
}

export async function sendRequestWithRetry(
  socketPath: string,
  number: number,
  reqId: string | undefined = undefined,
  maxRetries = 5,
  initialBackoff = 0.5,
  createSocket: (path: string) => net.Socket = defaultCreateSocket,
): Promise<number> {
  const requestId = reqId ?? randomUUID().slice(0, 8);
  const payload = `${requestId}:${number}`;
  let backoff = initialBackoff;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      verifySocketPermissions(socketPath);

      const responseData = await requestOnce(socketPath, payload, createSocket);
      const [receivedId, resultStr] = responseData.split(":", 2);

      if (receivedId === undefined || resultStr === undefined) {
        throw new IntegrityError("Server returned a malformed response.");
      }

      if (receivedId !== requestId) {
        throw new IntegrityError(
          `Security/Integrity Fault! Request ID mismatch. Expected '${requestId}', received '${receivedId}'`,
        );
      }

      const result = Number.parseInt(resultStr, 10);
      if (Number.isNaN(result)) {
        throw new IntegrityError("Server returned a non-numeric result.");
      }

      console.log(
        `Success! [Validated ID: ${receivedId}] Result: ${resultStr}`,
      );
      return result;
    } catch (error) {
      if (error instanceof PermissionError) {
        console.log(`[FATAL SECURITY ERROR]: ${error.message}`);
        throw error;
      }

      if (error instanceof IntegrityError) {
        console.log(`  [CRITICAL DATA FAILURE]: ${error.message}`);
        throw error;
      }

      console.log(`  Attempt ${attempt} failed: ${error}`);
      if (attempt === maxRetries) {
        console.log("Max retries reached. Failing.");
        throw error;
      }

      console.log(`  Retrying in ${backoff} seconds...`);
      await sleep(backoff * 1000);
      backoff *= 2;
    }
  }

  throw new Error("Unreachable retry loop exit.");
}

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
  console.log("--- Running Secure Validating Client ---");

  try {
    await sendRequestWithRetry(socketPath, 55);
  } catch (error) {
    console.log(`Execution terminated: ${error}`);
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main();
}
