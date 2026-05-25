import socket
import os
import time
import uuid
import argparse
import stat


def verify_socket_permissions(socket_path):
    if not os.path.exists(socket_path):
        return

    file_stat = os.stat(socket_path)
    if file_stat.st_uid != os.getuid():
        raise PermissionError(
            "Security Violation: Socket file is owned by another user."
        )

    unwanted_permissions = file_stat.st_mode & (stat.S_IRWXG | stat.S_IRWXO)
    if unwanted_permissions != 0:
        raise PermissionError(
            "Security Violation: Socket permissions are too open (must be 0600)."
        )


def send_request_with_retry(
    socket_path, number, req_id=None, max_retries=5, initial_backoff=0.5
):
    if req_id is None:
        req_id = str(uuid.uuid4())[:8]

    payload = f"{req_id}:{number}".encode("utf-8")
    backoff = initial_backoff

    for attempt in range(1, max_retries + 1):
        try:
            verify_socket_permissions(socket_path)
        except PermissionError as e:
            print(f"[FATAL SECURITY ERROR]: {e}")
            raise e

        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            print(f"Attempt {attempt}: Connecting to server...")
            client.connect(socket_path)
            client.sendall(payload)

            # Receive response formatted as "req_id:result"
            response_data = client.recv(1024).decode("utf-8")
            if not response_data:
                raise socket.error("Empty response received from server")

            received_id, result_str = response_data.split(":", 1)

            # --- VALIDATION BLOCK ---
            if received_id != req_id:
                raise ValueError(
                    f"Security/Integrity Fault! Request ID mismatch. Expected '{req_id}', received '{received_id}'"
                )

            print(f"Success! [Validated ID: {received_id}] Result: {result_str}")
            return int(result_str)

        except (socket.error, ConnectionRefusedError, FileNotFoundError) as e:
            print(f"  Attempt {attempt} failed: {e}")
            if attempt == max_retries:
                print("Max retries reached. Failing.")
                raise e

            print(f"  Retrying in {backoff} seconds...")
            time.sleep(backoff)
            backoff *= 2

        except ValueError as val_err:
            # Drop the connection immediately if data integrity fails
            print(f"  [CRITICAL DATA FAILURE]: {val_err}")
            raise val_err

        finally:
            client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Secure Validating UDS IPC Client")
    parser.add_argument(
        "-s",
        "--socket",
        required=True,
        help="The file path to the target Unix Domain Socket",
    )
    args = parser.parse_args()

    print("--- Running Secure Validating Client ---")
    try:
        send_request_with_retry(socket_path=args.socket, number=55)
    except Exception as e:
        print(f"Execution terminated: {e}")
