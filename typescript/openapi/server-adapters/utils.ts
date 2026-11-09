export function sortValues<T>(values: T[], key: keyof T, order: "asc" | "desc"): T[] {
  const direction = order === "desc" ? -1 : 1;
  return [...values].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    if (leftValue === rightValue) return 0;
    if (leftValue === undefined || leftValue === null) return -direction;
    if (rightValue === undefined || rightValue === null) return direction;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }
    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}
