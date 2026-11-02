import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: true,
    exclude: ["dist/**", "node_modules/**"],
  },
});
