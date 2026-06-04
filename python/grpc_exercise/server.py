# pyright: reportAttributeAccessIssue=false
import asyncio
import argparse
import time

import grpc

import doubler_service_pb2 as pb2
import doubler_service_pb2_grpc as pb2_grpc


class DoublerService(pb2_grpc.DoublerServicer):
    def __init__(self):
        self._processed_requests = {}
        self._lock = asyncio.Lock()

    async def Double(self, request, context):
        async with self._lock:
            cached = self._processed_requests.get(request.request_id)
            if cached is not None:
                result = cached[0]
                print(
                    f"[CACHE HIT] Returning cached result for Request {request.request_id}"
                )
            else:
                result = request.number * 2
                self._processed_requests[request.request_id] = (result, time.time())
                print(
                    f"[NEW REQ] Processing Request {request.request_id}: Double {request.number}"
                )

        return pb2.DoubleResponse(request_id=request.request_id, result=result)

    async def cleanup_expired_requests(
        self, stop_event, ttl_seconds=300, interval_seconds=30
    ):
        while not stop_event.is_set():
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
                break
            except asyncio.TimeoutError:
                pass

            now = time.time()
            async with self._lock:
                expired = [
                    request_id
                    for request_id, (_, timestamp) in self._processed_requests.items()
                    if now - timestamp > ttl_seconds
                ]
                for request_id in expired:
                    del self._processed_requests[request_id]

            if expired:
                print(f"[CLEANUP] Purged {len(expired)} expired requests from memory.")


async def serve(address):
    server = grpc.aio.server()
    service = DoublerService()
    pb2_grpc.add_DoublerServicer_to_server(service, server)
    server.add_insecure_port(address)
    await server.start()
    print(f"gRPC server listening on {address}...")

    stop_event = asyncio.Event()
    cleanup_task = asyncio.create_task(service.cleanup_expired_requests(stop_event))

    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        print("\nExiting via KeyboardInterrupt...")
    finally:
        stop_event.set()
        await server.stop(grace=2)
        await cleanup_task
        print("Server shut down cleanly.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="gRPC Doubler Server")
    parser.add_argument(
        "-a",
        "--address",
        default="[::]:50051",
        help="The host and port for the gRPC server",
    )
    args = parser.parse_args()
    asyncio.run(serve(args.address))
