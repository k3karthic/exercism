Use the cluster module for CPU bound tasks so work can run across multiple cores instead of staying on one event loop thread.
This helps when the main work is heavy computation rather than waiting on IO.

The cluster module spawns a fixed pool of node.js worker processes up front. The primary process hands out tasks to idle workers in the pool; each worker keeps running, picking up the next task as soon as it finishes, until the queue is empty.

## Run Program

```bash
npx tsx parallelism/cluster.ts
```
