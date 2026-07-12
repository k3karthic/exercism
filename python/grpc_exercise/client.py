# pyright: reportAttributeAccessIssue=false
import argparse
import json
import uuid

import grpc

import doubler_service_pb2 as pb2
import doubler_service_pb2_grpc as pb2_grpc


RETRY_SERVICE_CONFIG = {
    "methodConfig": [
        {
            "name": [{"service": "doubler_service.Doubler", "method": "Double"}],
            "retryPolicy": {
                "maxAttempts": 5,
                "initialBackoff": "0.5s",
                "maxBackoff": "4s",
                "backoffMultiplier": 2,
                "retryableStatusCodes": ["UNAVAILABLE"],
            },
        }
    ]
}

CHANNEL_OPTIONS = (
    ("grpc.enable_retries", 1),
    ("grpc.service_config", json.dumps(RETRY_SERVICE_CONFIG)),
)


def send_request_with_retry(target, number, req_id=None):
    if req_id is None:
        req_id = str(uuid.uuid4())[:8]

    request = pb2.DoubleRequest(request_id=req_id, number=number)

    with grpc.insecure_channel(target, options=CHANNEL_OPTIONS) as channel:
        stub = pb2_grpc.DoublerStub(channel)
        response = stub.Double(request)

        if response.request_id != req_id:
            raise ValueError(
                f"Security/Integrity Fault! Request ID mismatch. Expected '{req_id}', received '{response.request_id}'"
            )

        print(
            f"Success! [Validated ID: {response.request_id}] Result: {response.result}"
        )
        return response.result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="gRPC Doubler Client")
    parser.add_argument(
        "-t",
        "--target",
        default="localhost:50051",
        help="The host and port of the target gRPC server",
    )
    parser.add_argument(
        "-n",
        "--number",
        type=int,
        default=55,
        help="The number to double",
    )
    args = parser.parse_args()

    print("--- Running gRPC Doubler Client ---")
    try:
        send_request_with_retry(target=args.target, number=args.number)
    except Exception as e:
        print(f"Execution terminated: {e}")
