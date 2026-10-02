import { afterEach, expect, test, vi } from "vitest";

import {
  collectDependencyNames,
  encodePackageName,
  getPackageLockVersion,
  inspectDependency,
  parseArgs,
  parseExactVersion,
} from "./check-dependency-age.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("parseArgs reads names, days, and json flag", () => {
  expect(parseArgs(["a", "--days", "30", "--json", "b"])).toEqual({
    dependencyNames: ["a", "b"],
    thresholdDays: 30,
    jsonOutput: true,
  });
  expect(parseArgs([])).toMatchObject({ thresholdDays: 365 });
});

test("parseArgs rejects invalid input", () => {
  expect(() => parseArgs([""])).toThrow("empty argument");
  expect(() => parseArgs(["--days"])).toThrow("requires a numeric value");
  expect(() => parseArgs(["--days", "0"])).toThrow("positive number");
  expect(() => parseArgs(["--days", "abc"])).toThrow("positive number");
  expect(() => parseArgs(["--nope"])).toThrow("Unknown argument");
});

test("parseExactVersion handles exact, aliased, and ranged specs", () => {
  expect(parseExactVersion("1.2.3")).toBe("1.2.3");
  expect(parseExactVersion("v1.2.3-beta.1")).toBe("1.2.3-beta.1");
  expect(parseExactVersion("npm:2.0.0")).toBe("2.0.0");
  expect(parseExactVersion("^1.2.3")).toBeNull();
  expect(parseExactVersion("npm:")).toBeNull();
});

test("getPackageLockVersion checks packages then legacy dependencies", () => {
  expect(getPackageLockVersion(null, "a")).toBeNull();
  expect(getPackageLockVersion({ packages: { "node_modules/a": { version: "1.0.0" } } }, "a")).toBe("1.0.0");
  expect(getPackageLockVersion({ dependencies: { a: { version: "2.0.0" } } }, "a")).toBe("2.0.0");
  expect(getPackageLockVersion({}, "a")).toBeNull();
});

test("collectDependencyNames merges and sorts", () => {
  expect(
    collectDependencyNames({
      dependencies: { b: "1", a: "1" },
      devDependencies: { a: "1", c: "1" },
    }),
  ).toEqual(["a", "b", "c"]);
  expect(collectDependencyNames({})).toEqual([]);
});

test("encodePackageName encodes scoped names", () => {
  expect(encodePackageName("@scope/pkg")).toBe("@scope%2fpkg");
  expect(encodePackageName("plain")).toBe("plain");
});

function stubRegistry(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? "OK" : "Server Error",
      json: async () => body,
    })),
  );
}

test("inspectDependency flags stale locked versions", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  stubRegistry({ time: { "1.0.0": "2023-01-01T00:00:00Z" } });

  const result = await inspectDependency(
    "stale-pkg",
    "^1.0.0",
    { packages: { "node_modules/stale-pkg": { version: "1.0.0" } } },
    365,
  );
  expect(result).toMatchObject({ stale: true, source: "package-lock.json" });
  expect(result.note).toBeUndefined();
});

test("inspectDependency falls back to latest registry version", async () => {
  stubRegistry({
    "dist-tags": { latest: "3.0.0" },
    time: { "3.0.0": new Date().toISOString() },
  });

  const result = await inspectDependency("fresh-pkg", "^3.0.0", null, 365);
  expect(result).toMatchObject({
    version: "3.0.0",
    stale: false,
    source: "registry",
  });
  expect(result.note).toContain("latest registry release");
});

test("inspectDependency handles exact specs without publish time", async () => {
  stubRegistry({ time: {} });

  const result = await inspectDependency("exact-pkg", "4.0.0", null, 365);
  expect(result).toMatchObject({
    source: "package.json",
    ageDays: null,
    stale: false,
  });
});

test("inspectDependency reports registry failures", async () => {
  stubRegistry({}, false);
  await expect(inspectDependency("broken-pkg", "5.0.0", null, 365)).rejects.toThrow("Failed to fetch npm metadata");

  stubRegistry({});
  await expect(inspectDependency("no-latest-pkg", "^1.0.0", null, 365)).rejects.toThrow("latest registry version");
});
