import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { installTargets, pathExists } from "./generate.ts";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "generate-"));
}

test("pathExists distinguishes missing paths", async () => {
  const dir = await tempDir();
  expect(await pathExists(dir)).toBe(true);
  expect(await pathExists(join(dir, "missing"))).toBe(false);
  await expect(pathExists(join(dir, "file\0bad"))).rejects.toThrow();
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
