const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

async function worker(
  input: number[],
  output: number[],
  workerId: number,
): Promise<void> {
  while (input.length > 0) {
    const num = input.shift();

    if (num === undefined) {
      break;
    }

    console.log(`Worker ${workerId} ${Date.now() / 1000} processing ${num}`);
    await sleep(1000);
    output.push(num * 2);
  }
}

async function main(): Promise<void> {
  const input = Array.from({ length: 10 }, (_, index) => index);
  const output: number[] = [];

  await Promise.all(
    Array.from({ length: 3 }, (_, workerId) => worker(input, output, workerId)),
  );

  console.log("Results:", output);
}

void main();
