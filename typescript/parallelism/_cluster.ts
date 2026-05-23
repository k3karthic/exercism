import cluster from "node:cluster";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";

type WorkMessage = {
  type: "work";
  start: number;
  end: number;
  values: number[];
};

type ResultMessage = {
  type: "result";
  updates: Array<{ index: number; value: number }>;
};

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const runThreadWorker = async (): Promise<void> => {
  if (typeof workerData !== "number") {
    throw new Error("Missing thread worker input");
  }

  await sleep(1000);
  parentPort?.postMessage(workerData * 2);
};

const runThread = (value: number) =>
  new Promise<number>((resolve, reject) => {
    const thread = new Worker(new URL(import.meta.url), {
      workerData: value,
      execArgv: ["--import", "tsx"],
    });

    thread.once("message", (result: number) => resolve(result));
    thread.once("error", reject);
    thread.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Thread exited with code ${code}`));
      }
    });
  });

const runClusterWorker = async () => {
  process.on("message", (message: WorkMessage) => {
    if (!message || message.type !== "work") {
      return;
    }

    void (async () => {
      try {
        const updates: ResultMessage["updates"] = [];

        for (let index = message.start; index < message.end; index += 1) {
          const value = message.values[index - message.start];

          if (value === undefined) {
            throw new Error(`Missing value for index ${index}`);
          }

          console.log(
            `Worker ${process.pid} processing index ${index}: ${value}`,
          );

          const doubled = await runThread(value);
          updates.push({ index, value: doubled });
        }

        process.send?.({ type: "result", updates }, () => {
          process.exit(0);
        });
      } catch (error: unknown) {
        console.error(error);
        process.exit(1);
      }
    })();
  });
};

const runPrimary = async () => {
  cluster.setupPrimary({ execArgv: ["--import", "tsx"] });

  const sharedMemory = Array.from({ length: 10 }, (_, index) => index);
  const partitions = [
    { start: 0, end: 4 },
    { start: 4, end: 7 },
    { start: 7, end: 10 },
  ];

  const workers: Array<Promise<void>> = [];

  for (const partition of partitions) {
    workers.push(
      new Promise<void>((resolve, reject) => {
        const worker = cluster.fork();

        worker.once("message", (message: ResultMessage) => {
          if (!message || message.type !== "result") {
            reject(new Error("Unexpected worker message"));
            return;
          }

          for (const update of message.updates) {
            sharedMemory[update.index] = update.value;
          }

          resolve();
        });

        worker.once("error", reject);
        worker.once("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          }
        });

        worker.send({
          type: "work",
          start: partition.start,
          end: partition.end,
          values: sharedMemory.slice(partition.start, partition.end),
        });
      }),
    );
  }

  for (const worker of workers) {
    await worker;
  }

  console.log("Results:", sharedMemory);
};

if (!isMainThread) {
  void runThreadWorker();
} else if (cluster.isPrimary) {
  void runPrimary();
} else {
  runClusterWorker().then(() => {});
}
