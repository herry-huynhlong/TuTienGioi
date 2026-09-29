export function CurrencyAmount({ amount, label = "Linh Thạch", className = "" }: { amount: bigint | number | string; label?: string; className?: string }) {
  const value = typeof amount === "bigint" || typeof amount === "number" ? amount.toLocaleString("vi-VN") : formatAmountString(amount);
  return (
    <span className={`currency-amount ${className}`} title={`${value} ${label}`} aria-label={`${value} ${label}`}>
      <img src="/items/currency/linh-thach.webp" alt="" aria-hidden />
      <span>{value}</span>
    </span>
  );
}

function formatAmountString(value: string) {
  if (!/^\d+$/.test(value)) return value;
  return BigInt(value).toLocaleString("vi-VN");
}
