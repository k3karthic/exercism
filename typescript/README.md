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

Prettier uses a 120-character line width (`.prettierrc.json`), matching the Python workspace's Ruff `line-length`. There is no separate linter in this workspace.

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

Fallow reports dead code, duplication, and complexity findings. Complexity
thresholds are explicit in `.fallowrc.json` and mirror the Python workspace's
pylint settings (`python/pyproject.toml`): cyclomatic complexity 10, and a
50-line unit size matching pylint's `max-statements`. Cognitive complexity (15)
and CRAP (30) have no pylint equivalent and keep Fallow's defaults. It exits non-zero
when findings exceed its thresholds. Generated files under `generated/`
directories are excluded, matching Knip's configuration. Its entry points mirror
Knip's; OpenAPI adapter exports and dependencies are accounted for explicitly
because the generated server consumes them dynamically.

## Analyze unused code

```bash
npm run knip
```

## Scan CVEs

```bash
npm run scan
```
