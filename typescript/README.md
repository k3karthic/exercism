## Init

```bash
npm init -y
npm install --save-dev typescript @types/node
npx tsc --init
```

## Run

```bash
npx ts-node index.ts
```

Add the above to package.json scripts

```json
"scripts": {
  "main": "ts-node index.ts"
},
```

Run with `npm run main`
