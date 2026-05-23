Use cluster and worker threads for CPU bound tasks so work can run across multiple cores instead of staying on one event loop thread.
This helps when the main work is heavy computation rather than waiting on IO.

## Run Program

```bash
npx tsx parallelism/_cluster.ts
```
