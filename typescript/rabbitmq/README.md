## Run the demo

Start RabbitMQ in one terminal:

```bash
podman run --rm --name some-rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3.9.10-management-alpine
```

In another terminal:

```bash
npx tsx rabbitmq/app.ts
```

The sample connects to RabbitMQ, sends five messages, doubles the numeric
ones, and writes malformed records to `rabbitmq/failed_messages.txt`.

## Run the tests

```bash
npx vitest run rabbitmq/test_app.test.ts
```

## Inspect RabbitMQ

Open http://127.0.0.1:15672/ to use the management UI.

Username: `guest`

Password: `guest`

![queues](../media/rabbitmq/queues.png)
![queue detail](../media/rabbitmq/queue_detail.png)
