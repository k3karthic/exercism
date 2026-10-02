export function parseSocketPath(argv: string[]): string {
  const index = argv.findIndex((arg) => arg === "-s" || arg === "--socket");
  if (index === -1) {
    throw new Error("The --socket argument is required.");
  }

  const socketPath = argv[index + 1];
  if (socketPath === undefined) {
    throw new Error("Missing value for --socket.");
  }

  return socketPath;
}
