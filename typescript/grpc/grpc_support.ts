import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import type { ProtoGrpcType } from "./generated/doubler_service.js";
import type { DoubleRequest__Output as GeneratedDoubleRequestOutput } from "./generated/doubler_service/DoubleRequest.js";
import type {
  DoubleResponse as GeneratedDoubleResponse,
  DoubleResponse__Output as GeneratedDoubleResponseOutput,
} from "./generated/doubler_service/DoubleResponse.js";
import type {
  DoublerClient as GeneratedDoublerClient,
  DoublerHandlers as GeneratedDoublerHandlers,
} from "./generated/doubler_service/Doubler.js";

export type DoubleRequest = GeneratedDoubleRequestOutput;
export type DoubleResponse = GeneratedDoubleResponse;
export type DoubleResponseOutput = GeneratedDoubleResponseOutput;
export type DoublerClient = GeneratedDoublerClient;
export type DoublerServiceImplementation = GeneratedDoublerHandlers;

export type SleepFn = typeof sleep;

const __dirname = dirname(fileURLToPath(import.meta.url));
const retryServiceConfig = {
  methodConfig: [
    {
      name: [{ service: "doubler_service.Doubler", method: "Double" }],
      retryPolicy: {
        maxAttempts: 5,
        initialBackoff: "0.5s",
        maxBackoff: "4s",
        backoffMultiplier: 2,
        retryableStatusCodes: ["UNAVAILABLE"],
      },
    },
  ],
} as const;

const channelOptions = {
  "grpc.enable_retries": 1,
  "grpc.service_config": JSON.stringify(retryServiceConfig),
} satisfies grpc.ChannelOptions;

function resolveProtoPath(): string {
  const localProtoPath = join(__dirname, "doubler_service.proto");
  if (existsSync(localProtoPath)) {
    return localProtoPath;
  }

  return join(process.cwd(), "grpc", "doubler_service.proto");
}

const protoPath = resolveProtoPath();

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const grpcObject = grpc.loadPackageDefinition(
  packageDefinition,
) as unknown as ProtoGrpcType;

export function getDoublerServiceConstructor(): ProtoGrpcType["doubler_service"]["Doubler"] {
  return grpcObject.doubler_service.Doubler;
}

export function createDoublerClient(target: string): DoublerClient {
  return new (getDoublerServiceConstructor())(
    target,
    grpc.credentials.createInsecure(),
    channelOptions,
  );
}

export function invokeDouble(
  client: DoublerClient,
  request: DoubleRequest,
): Promise<DoubleResponseOutput> {
  return new Promise<DoubleResponseOutput>((resolve, reject) => {
    client.Double(request, (error, response) => {
      if (error !== null) {
        reject(error);
        return;
      }

      if (response === undefined) {
        reject(new Error("The gRPC server returned no response."));
        return;
      }

      resolve(response);
    });
  });
}
