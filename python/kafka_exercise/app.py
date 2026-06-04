from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
from typing import Iterable

from kafka import (
    KafkaAdminClient,
    KafkaConsumer as _KafkaConsumer,
    KafkaProducer as _KafkaProducer,
)
from kafka.admin import NewTopic
from kafka.errors import TopicAlreadyExistsError
from kafka.structs import OffsetAndMetadata, TopicPartition

DEFAULT_TOPIC = "sample-numbers"
DEFAULT_MESSAGES = ["1", "2", "oops", "3", "4"]
DEFAULT_FAILED_MESSAGES_FILE = Path("failed_messages.txt")
DEFAULT_GROUP_ID = "sample-number-consumer"


def _encode(value: str) -> bytes:
    return value.encode("utf-8")


def _decode(value: bytes) -> str:
    return value.decode("utf-8")


class KafkaProducer:
    def __init__(self, bootstrap_servers: str, topic: str) -> None:
        self.topic = topic
        self._producer = _KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=_encode,
        )

    def send_messages(self, messages: Iterable[str]) -> None:
        try:
            for message in messages:
                self._producer.send(self.topic, value=message)
            self._producer.flush()
        finally:
            self._producer.close()


def ensure_topic(bootstrap_servers: str, topic: str) -> None:
    admin = KafkaAdminClient(bootstrap_servers=bootstrap_servers)
    try:
        admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=1)])
    except TopicAlreadyExistsError:
        pass
    finally:
        admin.close()


class KafkaConsumer:
    def __init__(self, bootstrap_servers: str, topic: str) -> None:
        self.topic = topic
        self._consumer = _KafkaConsumer(
            bootstrap_servers=bootstrap_servers,
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            group_id=DEFAULT_GROUP_ID,
            value_deserializer=_decode,
        )

    def consume_and_double_messages(
        self,
        *,
        failed_messages_path: Path,
        expected_messages: int,
    ) -> list[int]:
        doubled_numbers: list[int] = []
        seen_messages = 0

        try:
            self._consumer.subscribe([self.topic])

            for message in self._consumer:
                seen_messages += 1
                try:
                    doubled_numbers.append(int(message.value) * 2)
                except ValueError as error:
                    self._append_failed_message(
                        failed_messages_path=failed_messages_path,
                        raw_value=message.value,
                        error=error,
                        offset=message.offset,
                    )

                offsets_dict = {
                    TopicPartition(message.topic, message.partition): OffsetAndMetadata(
                        message.offset + 1,
                        None,
                        -1,
                    )
                }
                self._consumer.commit(offsets=offsets_dict)

                if seen_messages >= expected_messages:
                    break
        finally:
            self._consumer.close()

        return doubled_numbers

    def _append_failed_message(
        self,
        *,
        failed_messages_path: Path,
        raw_value: str,
        error: Exception,
        offset: int,
    ) -> None:
        failed_messages_path.parent.mkdir(parents=True, exist_ok=True)
        line = f"offset={offset} value={raw_value!r} error={error}\n"
        with failed_messages_path.open("a", encoding="utf-8") as file:
            file.write(line)


def run_demo(
    bootstrap_servers: str,
    *,
    topic: str = DEFAULT_TOPIC,
    failed_messages_path: Path = DEFAULT_FAILED_MESSAGES_FILE,
) -> list[int]:
    ensure_topic(bootstrap_servers, topic)
    producer = KafkaProducer(bootstrap_servers, topic)
    producer.send_messages(DEFAULT_MESSAGES)
    consumer = KafkaConsumer(bootstrap_servers, topic)
    return consumer.consume_and_double_messages(
        failed_messages_path=failed_messages_path,
        expected_messages=len(DEFAULT_MESSAGES),
    )


def main() -> None:
    parser = ArgumentParser(description="Run the Kafka number-doubling demo.")
    parser.add_argument(
        "--bootstrap-servers",
        default="localhost:9092",
        help="Kafka bootstrap servers, for example localhost:9092",
    )
    parser.add_argument(
        "--topic",
        default=DEFAULT_TOPIC,
        help=f"Kafka topic to use (default: {DEFAULT_TOPIC})",
    )
    parser.add_argument(
        "--failed-messages-path",
        default=str(DEFAULT_FAILED_MESSAGES_FILE),
        help=f"Path to the DLQ log file (default: {DEFAULT_FAILED_MESSAGES_FILE})",
    )
    args = parser.parse_args()

    doubled_numbers = run_demo(
        args.bootstrap_servers,
        topic=args.topic,
        failed_messages_path=Path(args.failed_messages_path),
    )
    print(doubled_numbers)


if __name__ == "__main__":
    main()
