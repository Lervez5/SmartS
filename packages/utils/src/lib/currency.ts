export function formatCurrency(
  amount: number,
  currency: { code: string; symbol: string; minorUnit?: string } = { code: "KES", symbol: "KSh", minorUnit: "cents" }
): string {
  const factor = currency.minorUnit === "cents" ? 100 : 1;
  const value = amount / factor;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency.code,
    currencyDisplay: "symbol",
  }).format(value).replace(currency.code, currency.symbol);
}

export function toMinorUnits(amount: number, minorUnit: string = "cents"): number {
  const factor = minorUnit === "cents" ? 100 : 1;
  return Math.round(amount * factor);
}

export function fromMinorUnits(amount: number, minorUnit: string = "cents"): number {
  const factor = minorUnit === "cents" ? 100 : 1;
  return amount / factor;
}
