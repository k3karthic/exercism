// From https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_3/lru_cache.py

const FIRST_COUNTER_RANGE = 500;
const SECOND_COUNTER_RANGE = 1000;

export class Algorithms {
  private readonly cache = new Map<number, bigint>();

  constructor(private readonly inc: bigint) {}

  factorialPlus(n: number): bigint {
    const cached = this.cache.get(n);
    if (cached !== undefined) {
      return cached;
    }

    const value = n > 1 ? BigInt(n) * this.factorialPlus(n - 1) + this.inc : 1n + this.inc;
    this.cache.set(n, value);
    return value;
  }
}

export function* generateFactorialPlusLastDigit(
  plusRange: number,
  factorialRange: number,
): IterableIterator<number> {
  for (let i = 0; i < plusRange; i += 1) {
    const algorithm = new Algorithms(BigInt(i));
    for (let j = 0; j < factorialRange; j += 1) {
      yield Number(algorithm.factorialPlus(j) % 10n);
    }
  }
}

function mostCommon(values: Iterable<number>): Array<[number, number]> {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function compareCountsDifferentFactorials(): void {
  const counts_500 = mostCommon(
    generateFactorialPlusLastDigit(FIRST_COUNTER_RANGE, FIRST_COUNTER_RANGE),
  );
  const counts_1000 = mostCommon(
    generateFactorialPlusLastDigit(SECOND_COUNTER_RANGE, SECOND_COUNTER_RANGE),
  );

  console.log(counts_500);
  console.log(counts_1000);
}
