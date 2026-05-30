from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path
from typing import Any

import pytest

UDS_DIR = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


server: Any = load_module("uds_server_test", UDS_DIR / "server.py")
client: Any = load_module("uds_client_test", UDS_DIR / "client.py")


class FakeReader:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    async def read(self, n: int) -> bytes:
        return self.payload


class FakeWriter:
    def __init__(self) -> None:
        self.buffer = bytearray()
        self.closed = False

    def write(self, data: bytes) -> None:
        self.buffer.extend(data)

    async def drain(self) -> None:
        return None

    def close(self) -> None:
        self.closed = True

    async def wait_closed(self) -> None:
        return None


def test_secure_cleanup_existing_removes_owned_path(tmp_path: Path) -> None:
    socket_path = tmp_path / "service.sock"
    socket_path.write_text("placeholder")

    service = server.AsyncIdempotentServer(str(socket_path))
    service._secure_cleanup_existing()

    assert not socket_path.exists()


@pytest.mark.asyncio
async def test_handle_client_caches_results() -> None:
    service = server.AsyncIdempotentServer("/tmp/unused.sock")

    first_writer = FakeWriter()
    await service._handle_client(FakeReader(b"req-1:5"), first_writer)

    second_writer = FakeWriter()
    await service._handle_client(FakeReader(b"req-1:99"), second_writer)

    assert first_writer.buffer.decode("utf-8") == "req-1:10"
    assert second_writer.buffer.decode("utf-8") == "req-1:10"
    assert len(service.processed_requests) == 1


def test_verify_socket_permissions_rejects_loose_permissions(tmp_path: Path) -> None:
    socket_path = tmp_path / "service.sock"
    socket_path.write_text("placeholder")
    socket_path.chmod(0o644)

    with pytest.raises(PermissionError, match="too open"):
        client.verify_socket_permissions(str(socket_path))


def test_send_request_with_retry_returns_int_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeSocket:
        def __init__(self, response: bytes) -> None:
            self.response = response
            self.connected_to: str | None = None
            self.sent: bytes | None = None
            self.closed = False

        def connect(self, socket_path: str) -> None:
            self.connected_to = socket_path

        def sendall(self, payload: bytes) -> None:
            self.sent = payload

        def recv(self, size: int) -> bytes:
            return self.response

        def close(self) -> None:
            self.closed = True

    with tempfile.TemporaryDirectory() as temp_dir:
        socket_path = Path(temp_dir) / "service.sock"
        socket_path.write_text("placeholder")
        socket_path.chmod(0o600)

        fake_socket = FakeSocket(b"req-7:14")
        monkeypatch.setattr(
            client.socket,
            "socket",
            lambda family, kind: fake_socket,
        )
        monkeypatch.setattr(client.time, "sleep", lambda seconds: None)

        result = client.send_request_with_retry(
            str(socket_path), 7, req_id="req-7", max_retries=1
        )

    assert result == 14
    assert fake_socket.connected_to == str(socket_path)
    assert fake_socket.sent == b"req-7:7"
    assert fake_socket.closed
