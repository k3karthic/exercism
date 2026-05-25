import socket
import os
import time
import threading
import argparse


class IdempotentServer:
    def __init__(self, socket_path):
        self.socket_path = socket_path
        self.processed_requests = {}
        self.lock = threading.Lock()
        self.is_running = True

    def _secure_cleanup_existing(self):
        if os.path.exists(self.socket_path):
            file_stat = os.stat(self.socket_path)
            if file_stat.st_uid != os.getuid():
                raise PermissionError(
                    f"Security Alert: Socket path '{self.socket_path}' is owned by another user."
                )
            os.remove(self.socket_path)

    def start(self):
        try:
            self._secure_cleanup_existing()
        except PermissionError as e:
            print(e)
            return

        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            server.bind(self.socket_path)
            os.chmod(self.socket_path, 0o600)
        except OSError as e:
            print(f"Failed to bind to socket path '{self.socket_path}': {e}")
            return

        server.listen(5)
        print(f"Server listening on path: {self.socket_path}...")

        cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        cleanup_thread.start()

        try:
            while self.is_running:
                conn, _ = server.accept()
                threading.Thread(
                    target=self._handle_client, args=(conn,), daemon=True
                ).start()
        except KeyboardInterrupt:
            print("\nShutting down server...")
        finally:
            self.is_running = False
            server.close()
            if os.path.exists(self.socket_path):
                try:
                    os.remove(self.socket_path)
                except PermissionError:
                    pass

    def _handle_client(self, conn):
        try:
            data = conn.recv(1024).decode("utf-8")
            if not data:
                return

            req_id, num_str = data.split(":", 1)
            number = int(num_str)

            with self.lock:
                if req_id in self.processed_requests:
                    print(f"[CACHE HIT] Returning cached result for Request {req_id}")
                    result = self.processed_requests[req_id][0]
                else:
                    print(f"[NEW REQ] Processing Request {req_id}: Double {number}")
                    result = number * 2
                    self.processed_requests[req_id] = (result, time.time())

            # Format response payload to echo back the req_id
            response_payload = f"{req_id}:{result}"
            conn.sendall(response_payload.encode("utf-8"))
        except Exception as e:
            print(f"Error handling request: {e}")
        finally:
            conn.close()

    def _cleanup_loop(self):
        while self.is_running:
            time.sleep(30)
            now = time.time()
            with self.lock:
                expired = [
                    req_id
                    for req_id, (_, ts) in self.processed_requests.items()
                    if now - ts > 300
                ]
                for req_id in expired:
                    del self.processed_requests[req_id]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Secure Idempotent UDS IPC Server")
    parser.add_argument(
        "-s",
        "--socket",
        required=True,
        help="The absolute file path for the Unix Domain Socket",
    )
    args = parser.parse_args()

    server = IdempotentServer(args.socket)
    server.start()
