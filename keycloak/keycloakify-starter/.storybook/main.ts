import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [path.join(__dirname, "../node_modules/@storybook/addon-vitest")],
    framework: {
        name: "@storybook/react-vite",
        options: {}
    },
    staticDirs: ["../public"]
};
export default config;
