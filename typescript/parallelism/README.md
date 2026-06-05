Use cluster and worker threads for CPU bound tasks so work can run across multiple cores instead of staying on one event loop thread.
This helps when the main work is heavy computation rather than waiting on IO.

The cluster module spawns a new node.js process to better utilize multiple cores. Each process then spawns a worker thread for the CPU intensive calculation to ensure that the event loop is not blocked.

## Run Program

```bash
npx tsx parallelism/cluster.ts
```
