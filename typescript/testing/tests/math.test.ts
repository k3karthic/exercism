import { describe, expect, test } from "vitest";
import { average, clamp, sum } from "../src/math.js";

describe("math helpers", () => {
  test("clamps values into the requested range", () => {
    expect(clamp(14, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test.each([
    { values: [1, 2, 3], expected: 6 },
    { values: [10, -4, 2], expected: 8 },
    { values: [], expected: 0 },
  ])("sums %#", ({ values, expected }) => {
    expect(sum(values)).toBe(expected);
  });

  test.each([
    { values: [2, 4, 6], expected: 4 },
    { values: [5], expected: 5 },
    { values: [], expected: 0 },
  ])("averages %#", ({ values, expected }) => {
    expect(average(values)).toBe(expected);
  });
});
