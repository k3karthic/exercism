export function parseSocketPath(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-s" || value === "--socket") {
      const socketPath = argv[index + 1];
      if (socketPath === undefined) {
        throw new Error("Missing value for --socket.");
      }

      return socketPath;
    }
  }

  throw new Error("The --socket argument is required.");
}
