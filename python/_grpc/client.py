# pyright: reportAttributeAccessIssue=false
import argparse
import time
import uuid

import grpc

import doubler_service_pb2 as pb2
import doubler_service_pb2_grpc as pb2_grpc


def send_request_with_retry(
    target, number, req_id=None, max_retries=5, initial_backoff=0.5
):
    if req_id is None:
        req_id = str(uuid.uuid4())[:8]

    request = pb2.DoubleRequest(request_id=req_id, number=number)
    backoff = initial_backoff

    with grpc.insecure_channel(target) as channel:
        stub = pb2_grpc.DoublerStub(channel)

        for attempt in range(1, max_retries + 1):
            try:
                print(f"Attempt {attempt}: Connecting to server...")
                response = stub.Double(request)

                if response.request_id != req_id:
                    raise ValueError(
                        f"Security/Integrity Fault! Request ID mismatch. Expected '{req_id}', received '{response.request_id}'"
                    )

                print(
                    f"Success! [Validated ID: {response.request_id}] Result: {response.result}"
                )
                return response.result

            except (grpc.RpcError, ConnectionError) as err:
                print(f"  Attempt {attempt} failed: {err}")
                if attempt == max_retries:
                    print("Max retries reached. Failing.")
                    raise

                print(f"  Retrying in {backoff} seconds...")
                time.sleep(backoff)
                backoff *= 2


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
