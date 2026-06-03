## Generate tsoa routes and OpenAPI spec

From `typescript/`:

```bash
npm run tsoa:spec
npm run tsoa:routes
```

## Run the server

```bash
npx tsx openapi/server.ts
```

## Run the tests

```bash
npm run test:openapi
```

## OpenAPI docs

The generated specification is written to `openapi/build/swagger.json`.
Requests use the `api_key` header with the value `some-api-key`.
