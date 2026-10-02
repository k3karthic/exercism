# OpenTelemetry sample

This sample shows manual OpenTelemetry traces, metrics, and logs in
TypeScript, plus manual trace context propagation across a subprocess
boundary.

## What it does

- `Service1` spawns `service-2-process.ts` as a **subprocess** (via `tsx`)
  for each message and hands it trace context through
  `TRACEPARENT`/`TRACESTATE` environment variables
- `service-2-process.ts` contains the `Service2` implementation and process
  entry point; it doubles numeric values and rejects an invalid message
- common telemetry setup and types live in `utils.ts`
- both processes emit traces, metrics, and logs, and the subprocess's span
  nests under the same trace as the caller's, even though nothing but an
  env var crossed the process boundary
- context is propagated with `propagation.inject`/`extract` from
  `@opentelemetry/api` (the same API a real HTTP/gRPC client and server
  instrumentation library would call for you automatically); it's called by
  hand here only because there's no such library for "subprocess + env var"
  as a transport. In production, prefer an existing instrumentation (e.g.
  `@opentelemetry/instrumentation-http`, a gRPC client/server interceptor)
  over wiring this up yourself.

## Run OpenObserve locally

Use the OpenObserve self-hosted Docker option from the docs:

```bash
podman run --rm --name openobserve \
  -v $PWD/openobserve-data:/data \
  -e ZO_DATA_DIR="/data" \
  -e ZO_ROOT_USER_EMAIL="root@example.com" \
  -e ZO_ROOT_USER_PASSWORD="Complexpass#123" \
  -p 5080:5080 \
  -p 5081:5081 \
  public.ecr.aws/zinclabs/openobserve:latest
```

OpenObserve listens on `http://localhost:5080`.

## Run the OTLP gRPC collector

OpenObserve ingests OTLP data through a collector. Save this as
`collector.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  otlp_grpc/openobserve:
    endpoint: host.docker.internal:5081
    headers:
      Authorization: "Basic <base64(root@example.com:Complexpass#123)>"
      organization: default
      stream-name: otel-sample
    tls:
      insecure: true

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [otlp_grpc/openobserve]
    metrics:
      receivers: [otlp]
      exporters: [otlp_grpc/openobserve]
    traces:
      receivers: [otlp]
      exporters: [otlp_grpc/openobserve]
```

Then start the collector with your preferred image or binary and point the app
at it with `OTEL_EXPORTER_OTLP_ENDPOINT=127.0.0.1:4317`. The app itself only
needs the collector endpoint; the OpenObserve credentials stay in the collector
config.

```bash
podman run --rm \
  --add-host host.docker.internal:host-gateway \
  -p 4317:4317 \
  -v "$PWD/collector.yaml:/etc/otelcol-contrib/config.yaml" \
  otel/opentelemetry-collector-contrib:latest \
  --config /etc/otelcol-contrib/config.yaml
```

## Run the sample

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=127.0.0.1:4317 npx tsx opentelemetry/app.ts
```

`Service1` sends `1`, `2`, `oops`, `3`, and `4` to `Service2` by spawning
`service-2-process.ts` as a subprocess once per message (`tsx
service-2-process.ts <value>`). Each process exports telemetry with its own
service name, so the trace graph shows both `service_1` and `service_2`,
nested under the same trace despite running in separate OS processes.

## Manual context propagation across the subprocess boundary

`Service1.callService2` builds a carrier object with
`propagation.inject(context.active(), carrier)`, then copies its
`traceparent`/`tracestate` values into the subprocess's environment as
`TRACEPARENT`/`TRACESTATE`. `service-2-process.ts` reads those env vars back
into a carrier and calls `propagation.extract(context.active(), carrier)` to
recover a context holding the remote parent span, then runs its own span
inside that context (via `context.with(...)`) — so it nests under
`Service1`'s trace.

This is exactly what OTel's HTTP/gRPC client and server instrumentation
libraries do for you automatically over the wire. Reach for those first;
only hand-roll `propagation.inject`/`extract` like this when propagating
across a transport with no existing instrumentation (here, "subprocess
argv/env").

## Auto instrumentation

Install the OpenTelemetry packages used for auto instrumentation:

```bash
npm install --save @opentelemetry/api @opentelemetry/auto-instrumentations-node
```

See the official guide: https://opentelemetry.io/docs/zero-code/js/

Then run the same command with the Node preload hook:

```bash
OTEL_SERVICE_NAME=otel-sample \
OTEL_EXPORTER_OTLP_ENDPOINT=127.0.0.1:4317 \
OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
OTEL_EXPORTER_OTLP_INSECURE=true \
NODE_OPTIONS=--require @opentelemetry/auto-instrumentations-node/register \
npx tsx opentelemetry/app.ts
```

## Run the tests

```bash
npx vitest run opentelemetry/test_app.test.ts
```

![logs](../media/opentelemetry/logs.png)
![metrics](../media/opentelemetry/metrics.png)
![traces](../media/opentelemetry/traces.png)
