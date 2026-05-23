import { formatUserCard } from "./format.js";
import { average } from "./math.js";

export type Delivery = {
  recipient: {
    name: string;
    role: string;
    active: boolean;
  };
  ratings: number[];
};

export function buildDeliverySummary(delivery: Delivery): string {
  const card = formatUserCard(delivery.recipient);
  const score = average(delivery.ratings).toFixed(1);

  return `${card}\nAverage rating: ${score}`;
}
