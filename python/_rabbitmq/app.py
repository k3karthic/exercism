from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
from typing import Iterable

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

DEFAULT_QUEUE = "sample-numbers"
DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"]
DEFAULT_FAILED_MESSAGES_FILE = Path("failed_messages.txt")
DEFAULT_USERNAME = "guest"
DEFAULT_PASSWORD = "guest"
DEFAULT_VIRTUAL_HOST = "/"
DEFAULT_PORT = 5672


def _encode(value: str) -> bytes:
    return value.encode("utf-8")


def _decode(value: bytes) -> str:
    return value.decode("utf-8")


def _close_connection(connection: pika.BlockingConnection | None) -> None:
    if connection is not None and connection.is_open:
        connection.close()


def build_connection_parameters(
    *,
    host: str,
    port: int = DEFAULT_PORT,
    username: str = DEFAULT_USERNAME,
    password: str = DEFAULT_PASSWORD,
    virtual_host: str = DEFAULT_VIRTUAL_HOST,
) -> pika.ConnectionParameters:
    return pika.ConnectionParameters(
        host=host,
        port=port,
        virtual_host=virtual_host,
        credentials=pika.PlainCredentials(username, password),
    )


class RabbitMQProducer:
    def __init__(
        self, connection_parameters: pika.ConnectionParameters, queue: str
    ) -> None:
        self._connection_parameters = connection_parameters
        self.queue = queue

    def send_messages(self, messages: Iterable[str]) -> None:
        connection: pika.BlockingConnection | None = None
        try:
            connection = pika.BlockingConnection(self._connection_parameters)
            channel = connection.channel()
            channel.queue_declare(queue=self.queue, durable=True)

            for message in messages:
                channel.basic_publish(
                    exchange="",
                    routing_key=self.queue,
                    body=_encode(message),
                )
        finally:
            _close_connection(connection)


def ensure_queue(connection_parameters: pika.ConnectionParameters, queue: str) -> None:
    connection: pika.BlockingConnection | None = None
    try:
        connection = pika.BlockingConnection(connection_parameters)
        channel = connection.channel()
        channel.queue_declare(queue=queue, durable=True)
    finally:
        _close_connection(connection)


class RabbitMQConsumer:
    def __init__(
        self, connection_parameters: pika.ConnectionParameters, queue: str
    ) -> None:
        self._connection_parameters = connection_parameters
        self.queue = queue

    def consume_and_double_messages(
        self,
        *,
        failed_messages_path: Path,
        expected_messages: int,
    ) -> list[int]:
        doubled_numbers: list[int] = []
        seen_messages = 0
        connection: pika.BlockingConnection | None = None

        try:
            connection = pika.BlockingConnection(self._connection_parameters)
            channel = connection.channel()
            channel.queue_declare(queue=self.queue, durable=True)
            channel.basic_qos(prefetch_count=1)

            def on_message(
                ch: BlockingChannel,
                method: Basic.Deliver,
                properties: BasicProperties,
                body: bytes,
            ) -> None:
                nonlocal seen_messages

                seen_messages += 1
                raw_value = _decode(body)

                try:
                    doubled_numbers.append(int(raw_value) * 2)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except ValueError as error:
                    self._append_failed_message(
                        failed_messages_path=failed_messages_path,
                        raw_value=raw_value,
                        error=error,
                        delivery_tag=method.delivery_tag,
                    )
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

                if seen_messages >= expected_messages:
                    ch.stop_consuming()

            channel.basic_consume(
                queue=self.queue,
                auto_ack=False,
                on_message_callback=on_message,
            )
            channel.start_consuming()
        finally:
            _close_connection(connection)

        return doubled_numbers

    def _append_failed_message(
        self,
        *,
        failed_messages_path: Path,
        raw_value: str,
        error: Exception,
        delivery_tag: int,
    ) -> None:
        failed_messages_path.parent.mkdir(parents=True, exist_ok=True)
        line = f"delivery_tag={delivery_tag} value={raw_value!r} error={error}\n"
        with failed_messages_path.open("a", encoding="utf-8") as file:
            file.write(line)


def run_demo(
    connection_parameters: pika.ConnectionParameters,
    *,
    queue: str = DEFAULT_QUEUE,
    failed_messages_path: Path = DEFAULT_FAILED_MESSAGES_FILE,
) -> list[int]:
    ensure_queue(connection_parameters, queue)
    producer = RabbitMQProducer(connection_parameters, queue)
    producer.send_messages(DEFAULT_MESSAGES)
    consumer = RabbitMQConsumer(connection_parameters, queue)
    return consumer.consume_and_double_messages(
        failed_messages_path=failed_messages_path,
        expected_messages=len(DEFAULT_MESSAGES),
    )


def main() -> None:
    parser = ArgumentParser(description="Run the RabbitMQ number-doubling demo.")
    parser.add_argument("--host", default="localhost", help="RabbitMQ host")
    parser.add_argument("--port", default=DEFAULT_PORT, type=int, help="RabbitMQ port")
    parser.add_argument(
        "--username",
        default=DEFAULT_USERNAME,
        help="RabbitMQ username",
    )
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help="RabbitMQ password",
    )
    parser.add_argument(
        "--virtual-host",
        default=DEFAULT_VIRTUAL_HOST,
        help="RabbitMQ virtual host",
    )
    parser.add_argument(
        "--queue",
        default=DEFAULT_QUEUE,
        help=f"RabbitMQ queue to use (default: {DEFAULT_QUEUE})",
    )
    parser.add_argument(
        "--failed-messages-path",
        default=str(DEFAULT_FAILED_MESSAGES_FILE),
        help=f"Path to the DLQ log file (default: {DEFAULT_FAILED_MESSAGES_FILE})",
    )
    args = parser.parse_args()

    connection_parameters = build_connection_parameters(
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        virtual_host=args.virtual_host,
    )
    doubled_numbers = run_demo(
        connection_parameters,
        queue=args.queue,
        failed_messages_path=Path(args.failed_messages_path),
    )
    print(doubled_numbers)


if __name__ == "__main__":
    main()
