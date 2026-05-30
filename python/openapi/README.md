# Petstore service

## Run the server

From this directory:

```bash
podman run --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres:16-alpine
DATABASE_URL=postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/postgres uv run uvicorn app:app --reload
```

To connect with `psql`:

```bash
psql -h localhost -U postgres -d postgres
```

## Run the tests

```bash
uv run pytest -q test_app.py
```

## OpenAPI docs

The FastAPI docs page is available at:

http://127.0.0.1:8000/docs

![auth screenshot](../media/openapi/authorization.png)
![sample screenshot](../media/openapi/sample.png)
