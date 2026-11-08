// Adapted from the Memray tutorials:
//   https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_1/fibonacci.py
//   https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_2/holding_onto_memory.py
//
// This exercise demonstrates two different memory anti-patterns in a single file.
// Three code paths run sequentially — two have memory issues, one is clean.
//
// Run a flamegraph profile to see which paths dominate memory:
//
//   npx flame run --sourcemap-dirs=dist dist/cpu_memory_visualization/ex_1.js
//
// The three paths:
//
//   processFibonacci   —  Path A (problematic): retains a large array of BigInts when only the sum is needed
//   processImage       —  Path B (problematic): holds lingering references to intermediate arrays
//   processPrimes      —  Path C (clean): efficiently computes primes using a boolean array
//
// Hint: two of the three paths have memory issues — one stores too much,
// the other fails to release intermediates.
//
// Note on profiling: flame uses V8's sampling-based heap profiler, which takes
// periodic snapshots of the current heap state. Since the three paths run
// sequentially, the profiler may only capture the path that dominates memory
// at the time of sampling. The async delays between paths give the sampler
// a better chance to capture each one. Unlike Python's memray (which tracks
// every allocation deterministically), V8 sampling produces a single-column
// flamegraph showing the dominant stack rather than sibling branches.

function fibonacci(length: number): bigint[] {
  /** Path A — stores the entire sequence in an array, but only the sum is needed. */
  if (length < 1) {
    return [];
  }
  if (length === 1) {
    return [1n];
  }

  const output: bigint[] = [1n, 1n];
  for (let i = 0; i < length - 2; i++) {
    output.push(output[i]! + output[i + 1]!);
  }
  return output;
}

function sieveOfEratosthenes(limit: number): number[] {
  /** Path C — efficiently computes primes using a boolean array and returns the list of primes. */
  if (limit < 2) {
    return [];
  }
  const isPrime = new Array(limit + 1).fill(true);
  isPrime[0] = false;
  isPrime[1] = false;
  for (let i = 2; i <= Math.sqrt(limit); i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isPrime[j] = false;
      }
    }
  }
  const primes: number[] = [];
  for (let i = 0; i <= limit; i++) {
    if (isPrime[i]) {
      primes.push(i);
    }
  }
  return primes;
}

function processImage(): number[] {
  /** Path B — holds onto intermediate arrays via lingering references. */
  // Generate a large array of data (5 million values)
  const SIZE = 5 * 1000 * 1000;
  const data = new Array(SIZE).fill(1);

  // Each transformation creates a new array, but the previous references linger
  const dataPow = new Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    dataPow[i] = data[i] - 3;
  }

  const dataPow2 = new Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    dataPow2[i] = Math.pow(dataPow[i], 2);
  }

  const result = new Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    result[i] = dataPow2[i] * 2 + 10;
  }

  // Lingering references — data and dataPow are still alive in this scope
  // even though they are no longer needed after computing result.
  const _unused = data; // keeps the original array alive
  const _unusedPow = dataPow; // keeps the intermediate array alive
  void _unused;
  void _unusedPow;

  return result;
}

function processFibonacci(): bigint[] {
  /** Entry point for Path A (problematic). */
  return fibonacci(100000);
}

function processImageEntry(): number[] {
  /** Entry point for Path B (problematic). */
  return processImage();
}

function processPrimes(): number[] {
  /** Entry point for Path C (clean). */
  return sieveOfEratosthenes(200000);
}

// Keep all three results alive so all paths contribute to peak memory.
// Use async delays between paths so the sampling profiler can capture each one.
// V8's heap profiler takes periodic snapshots (one sample per ~512KB allocated),
// so we need each path to remain alive long enough to be sampled. Without delays,
// the dominant path (processImage) would consume nearly all samples.
async function main() {
  const ex1ResultA = processFibonacci();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const ex1ResultB = processImageEntry();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const ex1ResultC = processPrimes();
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(ex1ResultA.length);
  console.log(ex1ResultB.length);
  console.log(ex1ResultC.length);
}

main();
