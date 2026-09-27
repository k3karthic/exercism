# Petstore service

The canonical OpenAPI document is `../openapi/petstore.json`. Generated server
and client packages live under `openapi/generated/`. The generated server
handles routes and API schemas; `server.py` adapts those interfaces to the
handwritten SQLAlchemy persistence and service layers.

## Run the server

From this directory:

```bash
podman run --rm --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 postgres:16-alpine
```

In another terminal run:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/postgres \
  uv run uvicorn openapi.server:app --reload
```

To connect with `psql`:

```bash
psql -h localhost -U postgres -d postgres
```

## Run the tests

```bash
uv run pytest -q openapi
```

## Generate the Python server and client

The OpenAPI Generator CLI must be installed locally. From `python/`:

```sh
uv run python -m openapi.generate
```

Generation validates the root spec first, writes to temporary staging
directories, and replaces only `openapi/generated/server/` and
`openapi/generated/client/`. It never writes into the handwritten wrappers.
Edit `../openapi/petstore.json` as the source of truth, then regenerate.

The search operations use `POST` with JSON request bodies, as defined in the
OpenAPI spec.

## Call the server through the generated client

```bash
uv run python -m openapi.client_driver --base-url http://127.0.0.1:8000 --api-key some-api-key
```

## OpenAPI docs

Swagger UI is available at:

http://127.0.0.1:8000/docs

![auth screenshot](../media/openapi/authorization.png)
![sample screenshot](../media/openapi/sample.png)
