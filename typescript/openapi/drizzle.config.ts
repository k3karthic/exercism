import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./openapi/schema.ts",
  out: "./openapi/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:mysecretpassword@localhost:5432/petstore",
  },
});
