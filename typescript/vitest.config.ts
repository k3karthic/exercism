import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: true,
    exclude: ["dist/**", "node_modules/**"],
  },
  coverage: {
    provider: "istanbul",
    exclude: ["dist/**", "**/generated/**", "debugger/**", "**/*.test.ts", "**/*.test.ts.ts"],
  },
});
