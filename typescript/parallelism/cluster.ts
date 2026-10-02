import cluster, { type Worker } from "node:cluster";

const sleep = (delayMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs));

// Simulates a slow CPU bound calculation. Workers stay alive and handle one
// task at a time, so this work is spread across a fixed set of processes
// (and cores) instead of blocking a single event loop.
const runClusterWorker = (): void => {
  process.on("message", (value: number) => {
    void (async () => {
      console.log(`Worker ${process.pid} doubling ${value}`);
      await sleep(1000);
      process.send?.(value * 2);
    })();
  });
};

const POOL_SIZE = 2;

const runPrimary = async (): Promise<void> => {
  cluster.setupPrimary({ execArgv: ["--import", "tsx"] });

  const inputs = [1, 2, 3, 4, 5, 6];
  const results: number[] = [];
  const queue = inputs.map((value, index) => ({ value, index }));

  const pool: Worker[] = Array.from({ length: POOL_SIZE }, () => cluster.fork());

  await new Promise<void>((resolve, reject) => {
    let pending = inputs.length;

    const assignNext = (worker: Worker): void => {
      const task = queue.shift();

      if (!task) {
        return;
      }

      worker.once("message", (doubled: number) => {
        results[task.index] = doubled;
        pending -= 1;

        if (pending === 0) {
          resolve();
        } else {
          assignNext(worker);
        }
      });

      worker.send(task.value);
    };

    for (const worker of pool) {
      worker.once("error", reject);
      assignNext(worker);
    }
  });

  for (const worker of pool) {
    worker.kill();
  }

  console.log("Results:", results);
};

if (cluster.isPrimary) {
  void runPrimary();
} else {
  runClusterWorker();
}
