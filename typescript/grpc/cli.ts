/** Returns the value following the first occurrence of a `[short, long]` flag, or undefined if the flag is absent. */
export function optionValue(argv: string[], [short, long]: readonly [string, string]): string | undefined {
  const index = argv.findIndex((arg) => arg === short || arg === long);
  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1];
  if (value === undefined) {
    throw new Error(`Missing value for ${long}.`);
  }

  return value;
}

export function reportTermination(error: unknown): void {
  console.log(`Execution terminated: ${error instanceof Error ? error.message : error}`);
}
