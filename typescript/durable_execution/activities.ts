export const TASK_QUEUE = "durable-execution-task-queue";
export const TEMPORAL_TARGET = "localhost:7233";

export async function getRandomNumberActivity(): Promise<number> {
  return Math.floor(Math.random() * 100) + 1;
}

export async function doubleNumberActivity(number: number): Promise<number> {
  return number * 2;
}
