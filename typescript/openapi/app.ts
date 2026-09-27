import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";

const API_KEY = "some-api-key";
const API_SPEC_PATH = resolve(process.cwd(), "../openapi/petstore.json");
const SERVER_SPEC_PATH = new URL(
  "./generated/server/api/openapi.yaml",
  import.meta.url,
);
const swaggerDocument = JSON.parse(readFileSync(API_SPEC_PATH, "utf8"));

interface GeneratedExpressServer {
  app: Express;
  setupMiddleware(): void;
}

type GeneratedExpressServerConstructor = new (
  port: number,
  openApiYaml: string,
) => GeneratedExpressServer;

const require = createRequire(import.meta.url);
const GeneratedExpressServer =
  require("./generated/server/expressServer.js") as GeneratedExpressServerConstructor;

function requiresApiKey(request: Request): boolean {
  return (
    request.path === "/pet" ||
    request.path.startsWith("/pet/") ||
    request.path === "/store" ||
    request.path.startsWith("/store/")
  );
}

class PetstoreExpressServer extends GeneratedExpressServer {
  override setupMiddleware(): void {
    this.app.use(express.raw({ type: "application/octet-stream" }));
    this.app.use(
      (request: Request, response: Response, next: NextFunction): void => {
        if (requiresApiKey(request) && request.header("api_key") !== API_KEY) {
          response.status(403).json({ message: "Forbidden" });
          return;
        }
        next();
      },
    );
    this.app.use(
      ["/openapi", "/docs", "/swagger"],
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument),
    );
    super.setupMiddleware();
  }
}

const generatedServer = new PetstoreExpressServer(
  3000,
  fileURLToPath(SERVER_SPEC_PATH),
);

export const app = generatedServer.app;

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
): void => {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    next(error);
    return;
  }

  const candidate = error as {
    status: unknown;
    message?: unknown;
    errors?: unknown;
  };
  if (typeof candidate.status !== "number") {
    next(error);
    return;
  }

  if (candidate.status === 400 && candidate.errors !== undefined) {
    response.status(422).json({
      message: "Validation Failed",
      details: candidate.errors,
    });
    return;
  }

  response.status(candidate.status).json({
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : "Request failed",
  });
};

app.use((_request: Request, response: Response): void => {
  response.status(404).json({ message: "Not Found" });
});
app.use(errorHandler);
