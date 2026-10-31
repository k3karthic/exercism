import { createServer } from "vite";
import { app } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const isDev = process.env.NODE_ENV !== "production";

async function start() {
  if (isDev) {
    const vite = await createServer({
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
    app.listen(port, () => {
      console.log(`OpenAPI exercise server listening on http://localhost:${port} (HMR enabled)`);
    });
  } else {
    app.listen(port, () => {
      console.log(`OpenAPI exercise server listening on http://localhost:${port}`);
    });
  }
}

start();
