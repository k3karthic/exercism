import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi/build/swagger.json",
  output: "./openapi/api-client",
});
