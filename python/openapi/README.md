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
  uv run alembic -c openapi/alembic.ini upgrade head
DATABASE_URL=postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/postgres \
  uv run uvicorn openapi.server:app --reload
```

Alembic manages the schema; the server no longer auto-creates tables at
startup (`create_all` is reserved for the test suite's ephemeral database).

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

## Database schema migrations

[Alembic](https://alembic.sqlalchemy.org/) manages the `pet`/`order` table
schema, using the SQLAlchemy models in `database.py` as the single source of
truth (`openapi/alembic/env.py` autogenerates diffs against `Base.metadata`).
`create_all` is only used by the test suite's ephemeral Testcontainers
database; the running server relies exclusively on applied migrations.
`alembic.ini` lives in this directory (`openapi/`) rather than at the
`python/` root, so other exercises can configure their own Alembic setups
independently. From `python/`:

```bash
# apply all pending migrations (creates the pet/order tables on a fresh database)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/petstore \
  uv run alembic -c openapi/alembic.ini upgrade head

# after changing a model in database.py, generate a new revision
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/petstore \
  uv run alembic -c openapi/alembic.ini revision --autogenerate -m "describe the change"
```

Revisions live under `openapi/alembic/versions/`.

## Call the server through the generated client

```bash
uv run python -m openapi.client_driver --base-url http://127.0.0.1:8000 --api-key some-api-key
```

## OpenAPI docs

Swagger UI is available at:

http://127.0.0.1:8000/docs

![auth screenshot](../media/openapi/authorization.png)
![sample screenshot](../media/openapi/sample.png)
