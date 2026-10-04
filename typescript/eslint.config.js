import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["**/generated/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "max-params": ["error", { max: 5 }],
      "max-depth": ["error", { max: 4 }],
    },
  },
  {
    files: ["debugger/debugger_test.ts"],
    rules: {
      "no-debugger": "off",
    },
  },
);
