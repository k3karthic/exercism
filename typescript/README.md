## Init

```bash
npm init -y
npm install --save-dev typescript @types/node tsx
npx tsc --init
```

## Run

```bash
npx tsx index.ts
```

Add the above to package.json scripts

```json
"scripts": {
  "main": "tsx index.ts"
},
```

Run with `npm run main`
