export class JobQueue {
  #jobs: string[] = [];

  enqueue(job: string): number {
    this.#jobs.push(job);
    return this.#jobs.length;
  }

  next(): string | undefined {
    return this.#jobs.shift();
  }

  clear(): void {
    this.#jobs = [];
  }

  get size(): number {
    return this.#jobs.length;
  }
}
