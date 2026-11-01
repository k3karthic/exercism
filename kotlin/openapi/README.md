# Petstore service

The canonical OpenAPI document is `../../openapi/petstore.json`. Generated server
and client packages live under `build/generated-src/`. The generated server
handles routes and API schemas; `Main.kt` adapts those interfaces to the
handwritten persistence and service layers.

## Run the server

Start a local Postgres:

```bash
podman run --rm --name some-postgres \
  -e POSTGRES_USER=petstore -e POSTGRES_PASSWORD=petstore -e POSTGRES_DB=petstore \
  -p 5432:5432 docker.io/library/postgres:17-alpine
```

Defaults live in `src/main/resources/application.conf` and can be overridden with
`DB_JDBC_URL`, `DB_R2DBC_URL`, `DB_USER` and `DB_PASSWORD`.

In another terminal run:

```bash
./gradlew :openapi:run
```

## Database schema migrations

Flyway (JDBC) applies the migrations in `src/main/resources/db/migration` when the server starts.
The application itself is intended to use R2DBC.

Migrations are never generated automatically. After changing the tables in `db/Tables.kt`, apply
the existing migrations (start the server once, or run `:openapi:run`), then run:

```shell
./gradlew :openapi:generateMigrationScript -PmigrationName=add_something
```

The task diffs the Exposed tables against the configured database and writes the next
`V<n>__<name>.sql` file. Review it before committing.

## OpenAPI docs

Swagger UI is available at:

http://127.0.0.1:8000/docs

![auth screenshot](../media/openapi/authorization.png)
![sample screenshot](../media/openapi/sample.png)