# Petstore API

The shared contract is `../openapi/petstore.json`. OpenAPI Generator CLI
produces the Express server scaffold and TypeScript fetch client in
`typescript/openapi/generated/`. Regeneration only replaces those generated
directories. Express startup and API-key enforcement remain in handwritten
wrappers; generated controllers and service forwarding modules delegate to
handwritten adapters backed by Drizzle ORM and PostgreSQL.

## Generate the server scaffold and client

The OpenAPI Generator CLI must be installed locally. From `typescript/`:

```bash
npm run openapi:generate
```

The generated Express controllers delegate through adapters in
`openapi/server-adapters/` to the Drizzle-backed store. The generated client
and its model types are used directly by the example driver, services, and
tests.

## Run the server

Start PostgreSQL and apply the checked-in Drizzle migrations before starting
the server. For example, from `typescript/`:

```bash
podman run --rm --name some-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=petstore \
  -p 5432:5432 postgres:16-alpine
```

In another terminal, set `DATABASE_URL`, run migrations, then start the server:

```bash
export DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/petstore
npm run db:openapi:migrate
npx tsx openapi/server.ts
```

The server listens on port 3000 by default. Set `PORT` to override it.
Requests require the `api_key` header with the value `some-api-key`.
Swagger UI is available at `/swagger`, `/docs`, and `/openapi`.
The server does not create or migrate tables automatically.

## Database schema migrations

Drizzle Kit uses `openapi/schema.ts` as the schema source and stores versioned
migrations in `openapi/migrations/`. From `typescript/`, with `DATABASE_URL`
set to the target PostgreSQL database:

```bash
# Apply all pending migrations before starting the server
npm run db:openapi:migrate

# After changing the Drizzle schema, generate a migration for review
npm run db:openapi:generate
```

The `pet` table stores category, tags, and photo URLs as JSONB. The `order`
table stores shipping dates as timezone-aware timestamps. Tests use an isolated
PostgreSQL Testcontainers database and apply these same migrations.

## Run the client driver

Start the server first, then from `typescript/`:

```bash
npx tsx openapi/client_driver.ts
```

Set `OPENAPI_BASE_URL` to use a different server URL.

## Run the tests

Docker or a compatible Testcontainers runtime must be available.

```bash
npm run test:openapi
```

![authorization](../media/openapi/authorization.png)
![sample](../media/openapi/sample.png)
