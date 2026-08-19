export function naira(n: number) {
  return "₦" + (n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
}
