# Petstore service

## Run the server

From this directory:

```bash
podman run --rm --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 postgres:16-alpine
```

In another terminal run:
```bash
DATABASE_URL=postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/postgres uv run uvicorn openapi.server:app --reload
```

To connect with `psql`:

```bash
psql -h localhost -U postgres -d postgres
```

## Run the tests

```bash
uv run pytest -q test_app.py
```

## Generate the OpenAPI client

```bash
uv run python -m openapi.generate_client --output-path openapi --overwrite
```

## Call the server with the generated client

```bash
uv run python -m openapi.client_driver --base-url http://127.0.0.1:8000 --api-key some-api-key
```

## OpenAPI docs

The FastAPI docs page is available at:

http://127.0.0.1:8000/docs

![auth screenshot](../media/openapi/authorization.png)
![sample screenshot](../media/openapi/sample.png)
