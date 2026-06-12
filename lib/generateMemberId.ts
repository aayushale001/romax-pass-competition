export function generateMemberId(seed = "MEM") {
  const prefix = seed
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(3, "M");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const datePart = new Date().getFullYear().toString().slice(2);

  return `${prefix}-${datePart}-${randomPart}`;
}
