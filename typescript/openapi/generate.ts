import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OPENAPI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEC_PATH = join(OPENAPI_ROOT, "openapi", "petstore.json");
const GENERATED_ROOT = join(dirname(fileURLToPath(import.meta.url)), "generated");
const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates", "server");
const CLIENT_TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates", "client");

interface GeneratedTarget {
  name: "server" | "client";
  stagedPath: string;
  targetPath: string;
}

function runGenerator(args: string[]): void {
  const openapitoolsPath = join(OPENAPI_ROOT, "openapitools.json");
  execFileSync("openapi-generator-cli", ["--openapitools", openapitoolsPath, ...args], {
    cwd: OPENAPI_ROOT,
    env: { ...process.env, PWD: OPENAPI_ROOT },
    stdio: "inherit",
  });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

type InstalledTarget = { targetPath: string; backupPath?: string };

async function rollbackTargets(installed: InstalledTarget[]): Promise<void> {
  for (const previous of installed.reverse()) {
    await rm(previous.targetPath, { recursive: true, force: true });
    if (previous.backupPath !== undefined) {
      await rename(previous.backupPath, previous.targetPath);
    }
  }
}

export async function installTargets(stagingRoot: string, targets: GeneratedTarget[]): Promise<void> {
  const installed: InstalledTarget[] = [];
  try {
    for (const target of targets) {
      const backupPath = join(stagingRoot, `.previous-${target.name}`);
      const hadPrevious = await pathExists(target.targetPath);
      if (hadPrevious) {
        await rename(target.targetPath, backupPath);
      }
      installed.push({
        targetPath: target.targetPath,
        ...(hadPrevious ? { backupPath } : {}),
      });
      await rename(target.stagedPath, target.targetPath);
    }
  } catch (error) {
    await rollbackTargets(installed);
    throw error;
  }
}

export async function generate(): Promise<void> {
  runGenerator(["validate", "--input-spec", SPEC_PATH]);
  await mkdir(GENERATED_ROOT, { recursive: true });
  const stagingRoot = await mkdtemp(join(GENERATED_ROOT, ".staging-"));
  try {
    const serverOutput = join(stagingRoot, "server");
    const clientOutput = join(stagingRoot, "client");
    runGenerator([
      "generate",
      "--generator-name",
      "nodejs-express-server",
      "--input-spec",
      SPEC_PATH,
      "--output",
      serverOutput,
      "--template-dir",
      TEMPLATES_DIR,
      "--additional-properties",
      "serverPort=3000",
    ]);
    runGenerator([
      "generate",
      "--generator-name",
      "typescript-fetch",
      "--input-spec",
      SPEC_PATH,
      "--output",
      clientOutput,
      "--template-dir",
      CLIENT_TEMPLATES_DIR,
      "--additional-properties",
      "dateLibrary=string,importFileExtension=.js,stringEnums=true,useSingleRequestParameter=true",
    ]);
    await installTargets(stagingRoot, [
      {
        name: "server",
        stagedPath: serverOutput,
        targetPath: join(GENERATED_ROOT, "server"),
      },
      {
        name: "client",
        stagedPath: clientOutput,
        targetPath: join(GENERATED_ROOT, "client"),
      },
    ]);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generate();
}
