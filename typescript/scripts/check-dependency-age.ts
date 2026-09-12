import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
  dependencies?: Record<string, { version?: string }>;
};

type RegistryMetadata = {
  'dist-tags'?: { latest?: string };
  time?: Record<string, string>;
};

type DependencyResult = {
  name: string;
  spec: string;
  version: string | null;
  publishedAt: Date | null;
  ageDays: number | null;
  stale: boolean;
  source: 'package-lock.json' | 'package.json' | 'registry';
  note?: string;
};

const DEFAULT_THRESHOLD_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function main() {
  const { dependencyNames, thresholdDays, jsonOutput } = parseArgs(process.argv.slice(2));
  const rootDir = await findProjectRoot(process.cwd());
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageLockPath = path.join(rootDir, 'package-lock.json');

  const packageJson = await readJson<PackageJson>(packageJsonPath);
  const packageLock = await readJson<PackageLock | null>(packageLockPath).catch(() => null);

  const targetNames =
    dependencyNames.length > 0
      ? dependencyNames
      : collectDependencyNames(packageJson);

  if (targetNames.length === 0) {
    throw new Error('No dependencies found in package.json.');
  }

  const results: DependencyResult[] = [];
  for (const name of targetNames) {
    const spec = findDependencySpec(packageJson, name);
    if (!spec) {
      throw new Error(`Dependency "${name}" is not listed in package.json.`);
    }

    const result = await inspectDependency(name, spec, packageLock, thresholdDays);
    results.push(result);
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    process.exit(results.some((result) => result.stale) ? 1 : 0);
  }

  printResults(results, thresholdDays);
  process.exit(results.some((result) => result.stale) ? 1 : 0);
}

function parseArgs(args: string[]) {
  const dependencyNames: string[] = [];
  let thresholdDays = DEFAULT_THRESHOLD_DAYS;
  let jsonOutput = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      throw new Error('Unexpected empty argument.');
    }

    if (arg === '--days') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--days requires a numeric value.');
      }

      thresholdDays = Number(value);
      if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
        throw new Error('--days must be a positive number.');
      }

      index += 1;
      continue;
    }

    if (arg === '--json') {
      jsonOutput = true;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    dependencyNames.push(arg);
  }

  return { dependencyNames, thresholdDays, jsonOutput };
}

async function findProjectRoot(startDir: string) {
  let currentDir = startDir;

  while (true) {
    try {
      await readFile(path.join(currentDir, 'package.json'), 'utf8');
      return currentDir;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        throw new Error('Could not find package.json in the current directory tree.');
      }

      currentDir = parentDir;
    }
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function collectDependencyNames(packageJson: PackageJson) {
  return Array.from(
    new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]),
  ).sort();
}

function findDependencySpec(packageJson: PackageJson, name: string) {
  return packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name] ?? null;
}

async function inspectDependency(
  name: string,
  spec: string,
  packageLock: PackageLock | null,
  thresholdDays: number,
) {
  const packageLockVersion = getPackageLockVersion(packageLock, name);
  const version = packageLockVersion ?? parseExactVersion(spec);
  const source: DependencyResult['source'] = packageLockVersion
    ? 'package-lock.json'
    : version
      ? 'package.json'
      : 'registry';

  const registryVersion = version ?? (await getLatestVersion(name));
  const publishedAt = await getPublishedAt(name, registryVersion);
  const ageDays = publishedAt
    ? Math.floor((Date.now() - publishedAt.getTime()) / MS_PER_DAY)
    : null;

  const result: DependencyResult = {
    name,
    spec,
    version: registryVersion,
    publishedAt,
    ageDays,
    stale: ageDays !== null ? ageDays >= thresholdDays : false,
    source,
  };

  if (packageLockVersion === null && version === null) {
    result.note = 'No exact version in package-lock.json; used latest registry release.';
  }

  return result;
}

function getPackageLockVersion(packageLock: PackageLock | null, name: string) {
  if (!packageLock) {
    return null;
  }

  const key = `node_modules/${name}`;
  return packageLock.packages?.[key]?.version ?? packageLock.dependencies?.[name]?.version ?? null;
}

function parseExactVersion(spec: string) {
  const npmAliasMatch = spec.match(/^npm:(.+)$/);
  const normalizedSpec = npmAliasMatch ? npmAliasMatch[1] : spec;
  if (!normalizedSpec) {
    return null;
  }

  const exactVersionMatch = normalizedSpec.match(/^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  return exactVersionMatch?.[1] ?? null;
}

async function getLatestVersion(name: string) {
  const metadata = await fetchRegistryMetadata(name);
  const latest = metadata['dist-tags']?.latest;
  if (!latest) {
    throw new Error(`Could not determine the latest registry version for "${name}".`);
  }

  return latest;
}

async function getPublishedAt(name: string, version: string) {
  const metadata = await fetchRegistryMetadata(name);
  const publishedAt = metadata.time?.[version];

  return publishedAt ? new Date(publishedAt) : null;
}

const registryCache = new Map<string, Promise<RegistryMetadata>>();

async function fetchRegistryMetadata(name: string) {
  const cached = registryCache.get(name);
  if (cached) {
    return cached;
  }

  const url = `https://registry.npmjs.org/${encodePackageName(name)}`;
  const pending = fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'dependency-age-checker',
    },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch npm metadata for "${name}": ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as RegistryMetadata;
  });

  registryCache.set(name, pending);
  return pending;
}

function encodePackageName(name: string) {
  return name.startsWith('@')
    ? `@${encodeURIComponent(name.slice(1)).replace(/%2F/g, '%2f')}`
    : encodeURIComponent(name);
}

function printResults(results: DependencyResult[], thresholdDays: number) {
  const staleResults = results.filter((result) => result.stale);

  if (staleResults.length === 0) {
    console.log(`No dependencies are older than ${thresholdDays} days.`);
    return;
  }

  const rows = staleResults.map((result) => {
    const status = result.stale ? 'STALE' : 'fresh';
    const version = result.version ?? 'unknown';
    const publishedAt = result.publishedAt ? result.publishedAt.toISOString().slice(0, 10) : 'unknown';
    const age = result.ageDays !== null ? `${result.ageDays}d` : 'unknown';
    return [result.name, version, publishedAt, age, status, result.source, result.note ?? ''].filter(Boolean);
  });

  const headers = ['dependency', 'version', 'published', 'age', 'status', 'source', 'note'];
  const widths = headers.map((header, columnIndex) =>
    Math.max(header.length, ...rows.map((row) => String(row[columnIndex] ?? '').length), 0),
  );

  console.log(`Threshold: ${thresholdDays} days`);
  console.log(
    headers
      .map((header, index) => header.padEnd(widths[index] ?? 0))
      .join('  '),
  );
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));

  for (const row of rows) {
    console.log(
      row
        .map((cell, index) => String(cell ?? '').padEnd(widths[index] ?? 0))
        .join('  '),
    );
  }

  console.log('');
  const staleCount = staleResults.length;
  console.log(
    `${staleCount} dependency${staleCount === 1 ? '' : 'ies'} are older than ${thresholdDays} days.`,
  );
}

await main();
