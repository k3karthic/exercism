# Petstore API

The shared contract is `../openapi/petstore.json`. OpenAPI Generator CLI
produces the Express server scaffold and TypeScript fetch client in
`typescript/openapi/generated/`. Regeneration only replaces those generated
directories. Express startup, API-key enforcement, and PetStore behavior remain
in handwritten wrappers and services outside them.

## Generate the server scaffold and client

The OpenAPI Generator CLI must be installed locally. From `typescript/`:

```bash
npm run openapi:generate
```

The generated Express controllers delegate through adapters in
`openapi/server-adapters/` to the handwritten in-memory store. The generated
client and its model types are used directly by the example driver, services,
and tests.

## Run the server

From `typescript/`:

```bash
npx tsx openapi/server.ts
```

The server listens on port 3000 by default. Set `PORT` to override it.
Requests require the `api_key` header with the value `some-api-key`.
Swagger UI is available at `/swagger`, `/docs`, and `/openapi`.

## Run the client driver

Start the server first, then from `typescript/`:

```bash
npx tsx openapi/client_driver.ts
```

Set `OPENAPI_BASE_URL` to use a different server URL.

## Run the tests

```bash
npm run test:openapi
```

![authorization](../media/openapi/authorization.png)
![sample](../media/openapi/sample.png)
