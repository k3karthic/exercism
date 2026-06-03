import type { Request } from "express";

const API_KEY = "some-api-key";

export function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[],
): Promise<void> {
  if (securityName !== "api_key") {
    return Promise.reject({ status: 403, message: "Forbidden" });
  }

  const apiKey = request.header("api_key");
  if (apiKey === API_KEY) {
    return Promise.resolve();
  }

  return Promise.reject({ status: 403, message: "Forbidden" });
}
