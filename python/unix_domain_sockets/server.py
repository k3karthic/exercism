import asyncio
import os
import time
import argparse


class AsyncIdempotentServer:
    def __init__(self, socket_path):
        self.socket_path = socket_path
        # Schema: { req_id: (result_value, timestamp) }
        self.processed_requests = {}
        self.is_running = True

    def _secure_cleanup_existing(self):
        """Safely removes an existing socket only if owned by the current user."""
        if os.path.exists(self.socket_path):
            file_stat = os.stat(self.socket_path)
            if file_stat.st_uid != os.getuid():
                raise PermissionError(
                    f"Security Alert: Socket path '{self.socket_path}' is owned by another user."
                )
            os.remove(self.socket_path)

    async def start(self):
        try:
            self._secure_cleanup_existing()
        except PermissionError as e:
            print(e)
            return

        # Start the UDS server using asyncio
        try:
            server = await asyncio.start_unix_server(
                self._handle_client, path=self.socket_path
            )
            # Restrict permissions to the owner immediately after creation
            os.chmod(self.socket_path, 0o600)
            print(f"[SECURITY] Set safe permissions (0600) on {self.socket_path}")
        except OSError as e:
            print(f"Failed to bind to socket path '{self.socket_path}': {e}")
            return

        print(f"Async Server listening on path: {self.socket_path}...")

        # Schedule the background cleanup loop task
        cleanup_task = asyncio.create_task(self._cleanup_loop())

        async with server:
            try:
                await server.serve_forever()
            except asyncio.CancelledError:
                print("\nServer task cancelled.")
            finally:
                self.is_running = False
                cleanup_task.cancel()
                if os.path.exists(self.socket_path):
                    try:
                        os.remove(self.socket_path)
                    except PermissionError:
                        pass
                print("Server shut down cleanly.")

    async def _handle_client(self, reader, writer):
        """Callback executed automatically whenever a client connects."""
        try:
            # Read up to 1024 bytes from the stream
            data = await reader.read(1024)
            if not data:
                return

            payload = data.decode("utf-8")
            req_id, num_str = payload.split(":", 1)
            number = int(num_str)

            # NOTE: No threading locks are needed here!
            # Asyncio runs on a single event loop thread, preventing race conditions.
            if req_id in self.processed_requests:
                print(f"[CACHE HIT] Returning cached result for Request {req_id}")
                result = self.processed_requests[req_id][0]
            else:
                print(f"[NEW REQ] Processing Request {req_id}: Double {number}")
                result = number * 2
                self.processed_requests[req_id] = (result, time.time())

            # Format and send response payload
            response_payload = f"{req_id}:{result}"
            writer.write(response_payload.encode("utf-8"))
            await writer.drain()  # Ensure data is completely flushed through the socket

        except Exception as e:
            print(f"Error handling request: {e}")
        finally:
            writer.close()
            await writer.wait_closed()

    async def _cleanup_loop(self):
        """Asynchronous background loop to purge expired cache tokens."""
        while self.is_running:
            try:
                await asyncio.sleep(
                    30
                )  # Non-blocking sleep shifts control back to event loop
                now = time.time()

                expired = [
                    req_id
                    for req_id, (_, ts) in self.processed_requests.items()
                    if now - ts > 300
                ]
                for req_id in expired:
                    del self.processed_requests[req_id]
                if expired:
                    print(
                        f"[CLEANUP] Purged {len(expired)} expired requests from memory."
                    )
            except asyncio.CancelledError:
                break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Secure Async Idempotent UDS Server")
    parser.add_argument(
        "-s",
        "--socket",
        required=True,
        help="The absolute file path for the Unix Domain Socket",
    )
    args = parser.parse_args()

    server_instance = AsyncIdempotentServer(args.socket)
    try:
        asyncio.run(server_instance.start())
    except KeyboardInterrupt:
        print("\nExiting via KeyboardInterrupt...")
