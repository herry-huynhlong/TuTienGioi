"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CurrencyAmount } from "@/components/CurrencyAmount";

export function ItemQuantityControl({
  name = "quantity",
  min = 1,
  max,
  defaultValue = 1,
  unitPrice,
  unitLabel = "Linh Thạch",
  submitLabel,
  disabledReason,
  disabled = false
}: {
  name?: string;
  min?: number;
  max: number;
  defaultValue?: number;
  unitPrice?: string;
  unitLabel?: string;
  submitLabel?: string;
  disabledReason?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const [transactionKey] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  });
  const safeMax = Math.max(0, Math.floor(max));
  const safeMin = safeMax > 0 ? Math.max(1, Math.floor(min)) : 0;
  const initial = safeMax > 0 ? clamp(defaultValue, safeMin, safeMax) : 0;
  const [quantity, setQuantity] = useState(initial);
  const total = useMemo(() => {
    if (!unitPrice || !/^\d+$/.test(unitPrice) || quantity < 1) return null;
    return (BigInt(unitPrice) * BigInt(quantity)).toLocaleString("vi-VN");
  }, [quantity, unitPrice]);

  const locked = disabled || safeMax < 1 || pending;
  const reason = disabledReason ?? (safeMax < 1 ? "Không thể thực hiện" : "");
  return (
    <div className="quantity-purchase">
      <input type="hidden" name="transactionKey" value={transactionKey} />
      <div className="quantity-control" aria-label="Số lượng">
        <button type="button" disabled={locked || quantity <= safeMin} onClick={() => setQuantity((value) => clamp(value - 1, safeMin, safeMax))}>-</button>
        <input
          className="field"
          name={name}
          type="number"
          min={safeMin}
          max={safeMax}
          value={quantity}
          disabled={locked}
          onChange={(event) => setQuantity(clamp(Number(event.target.value || safeMin), safeMin, safeMax))}
        />
        <button type="button" disabled={locked || quantity >= safeMax} onClick={() => setQuantity((value) => clamp(value + 1, safeMin, safeMax))}>+</button>
      </div>
      {total ? <b className="quantity-total">Tổng: {unitLabel === "Linh Thạch" ? <CurrencyAmount amount={total.replace(/\D/g, "") || "0"} /> : `${total} ${unitLabel}`}</b> : null}
      {reason && (disabled || safeMax < 1) ? <small className="quantity-disabled-reason">{reason}</small> : null}
      {submitLabel ? <button type="submit" className="btn btn-secondary" disabled={locked}>{pending ? "Đang xử lý..." : `${submitLabel} ${quantity > 0 ? quantity : ""}`}</button> : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
