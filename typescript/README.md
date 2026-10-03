## Init

```bash
npm ci
```

## Run

```bash
npx tsx index.ts
```

## Format

```bash
npm run format
```

Prettier uses a 120-character line width (`.prettierrc.json`), matching the Python workspace's Ruff `line-length`.

## Lint

```bash
npm run lint
```

ESLint uses the recommended typescript-eslint rules for TypeScript files. Generated
files under `generated/` are excluded. Use Fallow below for dead-code, dependency,
duplication, and complexity analysis.

## Test coverage

```bash
npm run coverage
```

Writes `coverage/coverage-final.json` and prints a summary.

## Analyze codebase

```bash
npm run fallow
```

For exact complexity (CRAP) scores, run `npm run coverage` first and pass the
report: `npm run fallow -- --coverage coverage/coverage-final.json`.

Each top-level directory is self-contained and has its own `.fallowrc.json`
(entry points relative to that directory, plus the same complexity thresholds).
`npm run fallow:each` runs Fallow separately in every directory that has one and
reports results per directory, using `coverage/coverage-final.json` when it
exists. `npm run fallow` still analyzes the whole workspace and is the one that
checks `package.json` dependencies.

Fallow reports dead code, duplication, and complexity findings. Complexity
thresholds are explicit in `.fallowrc.json` and mirror the Python workspace's
Ruff settings (`python/pyproject.toml`): cyclomatic complexity 10, and a
50-line unit size matching Ruff's `max-statements`. Cognitive complexity (15)
and CRAP (30) have no corresponding Ruff checks and keep Fallow's defaults. It
exits non-zero when findings exceed its thresholds. Generated files under `generated/`
directories are excluded. OpenAPI adapter exports and dependencies are accounted
for explicitly because the generated server consumes them dynamically. Fallow
also checks for unused code and dependencies.

## Scan CVEs

```bash
npm run scan
```
