import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DoubleRequest {
  request_id: string;
  number: number;
}

export interface DoubleResponse {
  request_id: string;
  result: number;
}

export type SleepFn = (milliseconds: number) => Promise<void>;

export interface DoublerClient extends grpc.Client {
  Double(
    request: DoubleRequest,
    callback: grpc.requestCallback<DoubleResponse>,
  ): grpc.ClientUnaryCall;
}

export type DoublerServiceImplementation = grpc.UntypedServiceImplementation & {
  Double: grpc.handleUnaryCall<DoubleRequest, DoubleResponse>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const grpcObject = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  doubler_service: {
    Doubler: grpc.ServiceClientConstructor;
  };
};

export function getDoublerServiceConstructor(): grpc.ServiceClientConstructor {
  return grpcObject.doubler_service.Doubler;
}

export function createDoublerClient(target: string): DoublerClient {
  return new (getDoublerServiceConstructor())(
    target,
    grpc.credentials.createInsecure(),
  ) as unknown as DoublerClient;
}

export function invokeDouble(
  client: DoublerClient,
  request: DoubleRequest,
): Promise<DoubleResponse> {
  return new Promise<DoubleResponse>((resolve, reject) => {
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
