import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import {
  appendControllerAliases,
  controllerAlias,
  disableGeneratedClientTypeChecking,
  installTargets,
  normalizeGeneratedFile,
  pathExists,
} from "./generate.ts";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "generate-"));
}

test("pathExists distinguishes missing paths", async () => {
  const dir = await tempDir();
  expect(await pathExists(dir)).toBe(true);
  expect(await pathExists(join(dir, "missing"))).toBe(false);
  await expect(pathExists(join(dir, "file\0bad"))).rejects.toThrow();
});

test("normalizeGeneratedFile rewrites imports, trims, and adds ts-nocheck once", () => {
  const source = 'import { a } from "./a.js";   \r\nexport const b = 1;\n\n\n';
  const normalized = normalizeGeneratedFile("x.ts", source);
  expect(normalized).toBe('// @ts-nocheck\nimport { a } from "./a.ts";\nexport const b = 1;\n');
  expect(normalizeGeneratedFile("x.ts", normalized)).toBe(normalized);
  expect(normalizeGeneratedFile("x.md", "# Title  \n")).toBe("# Title\n");
});

test("controllerAlias lower-cases the method name and requires an operationId and tag", () => {
  expect(controllerAlias("get", { operationId: "GetPetById", tags: ["pet"] })).toEqual({
    controllerName: "petController",
    alias: "module.exports.GetPetById = getPetById;",
  });
  expect(() => controllerAlias("get", { tags: ["pet"] })).toThrow("missing an operationId or tag");
  expect(() => controllerAlias("get", { operationId: "X" })).toThrow("missing an operationId or tag");
});

test("appendControllerAliases appends an alias per spec operation", async () => {
  const dir = await tempDir();
  await mkdir(join(dir, "controllers"));
  for (const name of ["PetController", "StoreController"]) {
    await writeFile(join(dir, "controllers", `${name}.js`), "// generated\n");
  }

  await appendControllerAliases(dir);

  const pet = await readFile(join(dir, "controllers", "PetController.js"), "utf8");
  expect(pet).toMatch(/module\.exports\.\w+ = \w+;/);
  expect(pet.startsWith("// generated\n\nmodule.exports.")).toBe(true);
});

test("disableGeneratedClientTypeChecking normalizes nested ts and md files only", async () => {
  const dir = await tempDir();
  await mkdir(join(dir, "nested"));
  await writeFile(join(dir, "nested", "a.ts"), 'import "./b.js";  \n');
  await writeFile(join(dir, "doc.md"), "text  \n");
  await writeFile(join(dir, "data.json"), "{}  \n");

  await disableGeneratedClientTypeChecking(dir);

  expect(await readFile(join(dir, "nested", "a.ts"), "utf8")).toBe('// @ts-nocheck\nimport "./b.ts";\n');
  expect(await readFile(join(dir, "doc.md"), "utf8")).toBe("text\n");
  expect(await readFile(join(dir, "data.json"), "utf8")).toBe("{}  \n");
});

async function stage(root: string, name: "server" | "client", marker: string) {
  const stagedPath = join(root, `staged-${name}`);
  await mkdir(stagedPath);
  await writeFile(join(stagedPath, "marker"), marker);
  return { name, stagedPath, targetPath: join(root, "target", name) };
}

test("installTargets replaces previous output", async () => {
  const root = await tempDir();
  await mkdir(join(root, "target", "server"), { recursive: true });
  await writeFile(join(root, "target", "server", "marker"), "old");
  const server = await stage(root, "server", "new-server");
  const client = await stage(root, "client", "new-client");

  await installTargets(root, [server, client]);

  expect(await readFile(join(server.targetPath, "marker"), "utf8")).toBe("new-server");
  expect(await readFile(join(client.targetPath, "marker"), "utf8")).toBe("new-client");
});

test("installTargets rolls back when a later target fails", async () => {
  const root = await tempDir();
  await mkdir(join(root, "target", "server"), { recursive: true });
  await writeFile(join(root, "target", "server", "marker"), "old");
  const server = await stage(root, "server", "new-server");
  const broken = {
    name: "client" as const,
    stagedPath: join(root, "does-not-exist"),
    targetPath: join(root, "target", "client"),
  };

  await expect(installTargets(root, [server, broken])).rejects.toThrow();

  expect(await readFile(join(server.targetPath, "marker"), "utf8")).toBe("old");
  expect(await pathExists(broken.targetPath)).toBe(false);
});
