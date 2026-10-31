import { defineConfig } from "vite";

export default defineConfig({
  server: {
    middlewareMode: true,
    hmr: {
      overlay: false,
    },
  },
  clearScreen: false,
});
