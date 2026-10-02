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

## Analyze codebase

```bash
npm run fallow
```

Fallow reports dead code, duplication, and complexity findings. It exits non-zero
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
