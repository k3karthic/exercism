from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pika
import pytest
from testcontainers.rabbitmq import RabbitMqContainer

from rabbitmq_exercise.app import DEFAULT_FAILED_MESSAGES_FILE, run_demo


@pytest.fixture(scope="session")
def rabbitmq_connection_parameters() -> Generator[
    pika.ConnectionParameters, None, None
]:
    with RabbitMqContainer("rabbitmq:3.9.10") as rabbitmq:
        yield rabbitmq.get_connection_params()


def test_run_demo_processes_numbers_and_logs_dlq(
    rabbitmq_connection_parameters: pika.ConnectionParameters, tmp_path: Path
) -> None:
    failed_messages_path = tmp_path / DEFAULT_FAILED_MESSAGES_FILE.name

    doubled_numbers = run_demo(
        rabbitmq_connection_parameters,
        failed_messages_path=failed_messages_path,
    )
    assert doubled_numbers == [2, 4, 6, 8]
    contents = failed_messages_path.read_text(encoding="utf-8")
    assert contents.startswith("delivery_tag=")
    assert "value='oops' error=" in contents
