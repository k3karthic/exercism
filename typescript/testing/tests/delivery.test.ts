import { describe, expect, test, vi } from "vitest";
import { buildDeliverySummary } from "../src/delivery.js";

vi.mock("../src/format.js", () => ({
  formatUserCard: vi.fn(() => "MOCKED CARD"),
}));

describe("buildDeliverySummary", () => {
  test("uses the mocked formatter and the real math helper", () => {
    const summary = buildDeliverySummary({
      recipient: {
        name: "Ada",
        role: "engineer",
        active: true,
      },
      ratings: [3, 4, 5],
    });

    expect(summary).toBe("MOCKED CARD\nAverage rating: 4.0");
  });
});
