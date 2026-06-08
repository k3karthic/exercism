import { client } from "./api-client/client.gen.js";
import { getInventory } from "./api-client/index.js";

const API_KEY = "some-api-key";
const BASE_URL = process.env.OPENAPI_BASE_URL ?? "http://localhost:3000";

client.setConfig({
  baseUrl: BASE_URL,
  auth: API_KEY,
});

async function main() {
  const { data, error } = await getInventory();

  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log("Inventory:", data);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
