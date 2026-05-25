import socket
import os
import time
import uuid
import argparse
import stat


def verify_socket_permissions(socket_path):
    """Ensures the socket file exists, is owned by the current user, and lacks group/world permissions."""
    if not os.path.exists(socket_path):
        return  # Let the connection attempt throw the native FileNotFoundError

    file_stat = os.stat(socket_path)
    current_uid = os.getuid()

    # 1. Check Owner
    if file_stat.st_uid != current_uid:
        raise PermissionError(
            f"Security Violation: Socket file is owned by UID {file_stat.st_uid}, but current user is UID {current_uid}."
        )

    # 2. Check Permissions (Mask out group and others: S_IRWXG | S_IRWXO -> 0o077)
    unwanted_permissions = file_stat.st_mode & (stat.S_IRWXG | stat.S_IRWXO)
    if unwanted_permissions != 0:
        raise PermissionError(
            f"Security Violation: Socket permissions are too open ({oct(file_stat.st_mode & 0o777)}). "
            "It must be restricted exclusively to the owner (0600)."
        )


def send_request_with_retry(
    socket_path, number, req_id=None, max_retries=5, initial_backoff=0.5
):
    if req_id is None:
        req_id = str(uuid.uuid4())[:8]

    payload = f"{req_id}:{number}".encode("utf-8")
    backoff = initial_backoff

    for attempt in range(1, max_retries + 1):
        # Perform security validation before creating socket and connecting
        try:
            verify_socket_permissions(socket_path)
        except PermissionError as e:
            print(f"[FATAL SECURITY ERROR]: {e}")
            raise e

        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            print(f"Attempt {attempt}: Connecting to secure server at {socket_path}...")
            client.connect(socket_path)

            client.sendall(payload)
            response = client.recv(1024).decode("utf-8")
            print(f"Success! Request {req_id} ({number} * 2) -> Result: {response}")
            return int(response)

        except (socket.error, ConnectionRefusedError, FileNotFoundError) as e:
            print(f"  Attempt {attempt} failed: {e}")
            if attempt == max_retries:
                print("Max retries reached. Failing.")
                raise e

            print(f"  Retrying in {backoff} seconds...")
            time.sleep(backoff)
            backoff *= 2

        finally:
            client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Secure Idempotent UDS IPC Client")
    parser.add_argument(
        "-s",
        "--socket",
        required=True,
        help="The file path to the target Unix Domain Socket",
    )
    args = parser.parse_args()

    print("--- Running Secure Client Tasks ---")
    try:
        send_request_with_retry(socket_path=args.socket, number=84)
    except PermissionError:
        print("Execution halted due to security compliance failure.")
