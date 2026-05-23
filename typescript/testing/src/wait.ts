export async function waitForLabel(
  label: string,
  delayMs: number,
  sleep: (delayMs: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<string> {
  await sleep(delayMs);
  return `${label} ready`;
}
