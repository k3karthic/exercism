from __future__ import annotations

from pathlib import Path
from collections.abc import Generator

import pytest
from testcontainers.kafka import KafkaContainer

from _kafka.app import DEFAULT_FAILED_MESSAGES_FILE, run_demo


@pytest.fixture(scope="session")
def kafka_bootstrap_server() -> Generator[str, None, None]:
    with KafkaContainer().with_kraft() as kafka:
        yield kafka.get_bootstrap_server()


def test_run_demo_processes_numbers_and_logs_dlq(
    kafka_bootstrap_server: str, tmp_path: Path
) -> None:
    failed_messages_path = tmp_path / DEFAULT_FAILED_MESSAGES_FILE.name

    doubled_numbers = run_demo(
        kafka_bootstrap_server,
        failed_messages_path=failed_messages_path,
    )

    assert doubled_numbers == [2, 4, 6, 8]
    assert failed_messages_path.read_text(encoding="utf-8").startswith(
        "offset=2 value='oops' error="
    )
