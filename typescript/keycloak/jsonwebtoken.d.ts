declare module "jsonwebtoken" {
  import type { KeyObject } from "node:crypto";

  export type JwtPayload = Record<string, unknown> & {
    nonce?: string;
    preferred_username?: string;
    name?: string;
    email?: string;
    sub?: string;
  };

  export interface JwtHeader {
    kid?: string;
    [key: string]: unknown;
  }

  export interface JwtDecodeCompleteResult {
    header: JwtHeader;
    payload: unknown;
  }

  export interface JwtDecodeOptions {
    complete?: boolean;
  }

  const jwt: {
    decode(
      token: string,
      options: JwtDecodeOptions & { complete: true },
    ): JwtDecodeCompleteResult | null;
    verify(
      token: string,
      key: KeyObject,
      options: {
        algorithms: readonly string[];
        audience: string;
        issuer: string;
      },
    ): JwtPayload | string;
  };

  export default jwt;
}
