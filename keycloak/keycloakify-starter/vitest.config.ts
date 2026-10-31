import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    test: {
        projects: [
            {
                extend: true,
                plugins: [
                    storybookTest({
                        configDir: path.join(__dirname, ".storybook"),
                        storybookScript: "storybook --no-open"
                    })
                ],
                test: {
                    name: "storybook",
                    setupFiles: [path.join(__dirname, ".storybook/vitest.setup.ts")],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [
                            {
                                browser: "chromium"
                            }
                        ]
                    }
                }
            }
        ]
    }
});
