import { StoreApi } from "./generated/client/apis/StoreApi.js";
import { Configuration } from "./generated/client/runtime.js";

const API_KEY = "some-api-key";
const BASE_URL = process.env.OPENAPI_BASE_URL ?? "http://localhost:3000";

async function main() {
  const api = new StoreApi(new Configuration({ basePath: BASE_URL, apiKey: API_KEY }));
  console.log("Inventory:", await api.getInventory());
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
