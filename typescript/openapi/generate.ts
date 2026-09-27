import { execFileSync } from "node:child_process";
import {
  appendFile,
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OPENAPI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEC_PATH = join(OPENAPI_ROOT, "openapi", "petstore.json");
const GENERATED_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "generated",
);

interface GeneratedTarget {
  name: "server" | "client";
  stagedPath: string;
  targetPath: string;
}

function runGenerator(args: string[]): void {
  execFileSync("openapi-generator-cli", args, {
    cwd: OPENAPI_ROOT,
    env: { ...process.env, PWD: OPENAPI_ROOT },
    stdio: "inherit",
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

async function replaceText(
  path: string,
  before: string,
  after: string,
): Promise<void> {
  const original = await readFile(path, "utf8");
  if (!original.includes(before)) {
    throw new Error(`Expected generated code not found in ${path}`);
  }
  await writeFile(path, original.replace(before, after), "utf8");
}

async function adaptGeneratedServer(serverPath: string): Promise<void> {
  const services = [
    ["PetService.js", "PetService.cjs"],
    ["StoreService.js", "StoreService.cjs"],
  ] as const;
  for (const [generatedName, adapterName] of services) {
    await writeFile(
      join(serverPath, "services", generatedName),
      `module.exports = require("../../../server-adapters/${adapterName}");\n`,
      "utf8",
    );
  }

  await replaceText(
    join(serverPath, "controllers", "PetController.js"),
    `const uploadPetImage = async (request, response) => {
  await Controller.handleRequest(request, response, service.uploadPetImage);
};`,
    `const uploadPetImage = async (request, response) => {
  await Controller.handleRequest(request, response, (params) =>
    service.uploadPetImage({ ...params, body: request.body }),
  );
};`,
  );

  await replaceText(
    join(serverPath, "expressServer.js"),
    "jsYaml.safeLoad(",
    "jsYaml.load(",
  );
  await replaceText(
    join(serverPath, "expressServer.js"),
    "    this.app.use(express.json());\n",
    "",
  );

  const spec = JSON.parse(await readFile(SPEC_PATH, "utf8")) as {
    paths: Record<
      string,
      Record<string, { operationId?: string; tags?: string[] }>
    >;
  };
  const aliases = new Map<string, Set<string>>();
  for (const pathItem of Object.values(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) {
        continue;
      }
      if (
        operation.operationId === undefined ||
        operation.tags?.[0] === undefined
      ) {
        throw new Error(
          `OpenAPI operation is missing an operationId or tag: ${method}`,
        );
      }
      const controllerName = `${operation.tags[0]}Controller`;
      const methodName =
        operation.operationId.charAt(0).toLowerCase() +
        operation.operationId.slice(1);
      const controllerAliases =
        aliases.get(controllerName) ?? new Set<string>();
      controllerAliases.add(
        `module.exports.${operation.operationId} = ${methodName};`,
      );
      aliases.set(controllerName, controllerAliases);
    }
  }
  for (const [controllerName, controllerAliases] of aliases) {
    const controllerPath = join(
      serverPath,
      "controllers",
      `${controllerName}.js`,
    );
    await appendFile(
      controllerPath,
      `\n${[...controllerAliases].join("\n")}\n`,
      "utf8",
    );
  }
}

async function disableGeneratedClientTypeChecking(
  directory: string,
): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await disableGeneratedClientTypeChecking(path);
    } else if (
      entry.isFile() &&
      (path.endsWith(".ts") || path.endsWith(".md"))
    ) {
      const source = await readFile(path, "utf8");
      let normalized = source
        .replace(/\.js(?=['"])/g, ".ts")
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .join("\n")
        .trimEnd();
      if (path.endsWith(".ts") && !normalized.startsWith("// @ts-nocheck")) {
        normalized = `// @ts-nocheck\n${normalized}`;
      }
      await writeFile(path, `${normalized}\n`, "utf8");
    }
  }
}

async function installTargets(
  stagingRoot: string,
  targets: GeneratedTarget[],
): Promise<void> {
  const installed: Array<{ targetPath: string; backupPath?: string }> = [];
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
    for (const previous of installed.reverse()) {
      if (await pathExists(previous.targetPath)) {
        await rm(previous.targetPath, { recursive: true, force: true });
      }
      if (previous.backupPath !== undefined) {
        await rename(previous.backupPath, previous.targetPath);
      }
    }
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
      "--additional-properties",
      "dateLibrary=string,importFileExtension=.js,stringEnums=true,useSingleRequestParameter=true",
    ]);
    await adaptGeneratedServer(serverOutput);
    await disableGeneratedClientTypeChecking(clientOutput);
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
