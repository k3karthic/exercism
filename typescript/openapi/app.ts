import express, {
  type NextFunction,
  type Request as ExRequest,
  type Response as ExResponse,
} from "express";
import { readFileSync } from "node:fs";
import swaggerUi from "swagger-ui-express";
import { ValidateError } from "tsoa";

import { RegisterRoutes } from "./build/routes.js";

const swaggerDocument = JSON.parse(
  readFileSync(new URL("./build/swagger.json", import.meta.url), "utf8"),
);

function hasHttpStatus(
  error: unknown,
): error is { status: number; message?: string } {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { status?: unknown; message?: unknown };
  return typeof candidate.status === "number";
}

export const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.raw({ type: "application/octet-stream" }));

app.use(["/openapi", "/docs", "/swagger"], swaggerUi.serve, swaggerUi.setup(swaggerDocument));

RegisterRoutes(app);

app.use((_request, response: ExResponse) => {
  response.status(404).json({
    message: "Not Found",
  });
});

app.use(
  (
    error: unknown,
    request: ExRequest,
    response: ExResponse,
    next: NextFunction,
  ): ExResponse | void => {
    if (error instanceof ValidateError) {
      return response.status(422).json({
        message: "Validation Failed",
        details: error.fields,
      });
    }

    if (hasHttpStatus(error)) {
      return response.status(error.status).json({
        message: error.message ?? "Request failed",
      });
    }

    if (error instanceof Error) {
      return response.status(500).json({
        message: "Internal Server Error",
      });
    }

    return next(error);
  },
);
