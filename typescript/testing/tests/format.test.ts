import { describe, expect, test } from "vitest";
import { formatUserCard } from "../src/format.js";

describe("formatUserCard", () => {
  test("matches the snapshot output", () => {
    expect(
      formatUserCard({
        name: "Grace",
        role: "maintainer",
        active: false,
      }),
    ).toMatchInlineSnapshot(`
      "Name: Grace
      Role: maintainer
      Status: inactive"
    `);
  });
});
