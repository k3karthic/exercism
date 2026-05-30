# Kafka sample

## Run the demo

From this directory:

```bash
podman run --name some-kafka -p 9092:9092 -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092 apache/kafka:latest
```

In another terminal:

```bash
uv run python app.py --bootstrap-servers localhost:9092
```

The sample connects to a Kafka broker you provide, sends five messages, doubles the
numeric ones, and writes malformed records to `failed_messages.txt`.

## Run the tests

```bash
uv run pytest -q test_app.py
```
