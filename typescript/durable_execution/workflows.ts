import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities.js";

const { getRandomNumberActivity, doubleNumberActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "5 seconds",
});

export async function doublerWorkflow(): Promise<number> {
  const number = await getRandomNumberActivity();
  return await doubleNumberActivity(number);
}
