"use client";

import { useMemo, useState } from "react";

export function ItemQuantityControl({
  name = "quantity",
  min = 1,
  max,
  defaultValue = 1,
  unitPrice,
  unitLabel = "Linh Thạch",
  submitLabel,
  disabled = false
}: {
  name?: string;
  min?: number;
  max: number;
  defaultValue?: number;
  unitPrice?: string;
  unitLabel?: string;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const safeMax = Math.max(0, Math.floor(max));
  const safeMin = safeMax > 0 ? Math.max(1, Math.floor(min)) : 0;
  const initial = safeMax > 0 ? clamp(defaultValue, safeMin, safeMax) : 0;
  const [quantity, setQuantity] = useState(initial);
  const total = useMemo(() => {
    if (!unitPrice || !/^\d+$/.test(unitPrice) || quantity < 1) return null;
    return (BigInt(unitPrice) * BigInt(quantity)).toLocaleString("vi-VN");
  }, [quantity, unitPrice]);

  const locked = disabled || safeMax < 1;
  return (
    <div className="quantity-purchase">
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
      {total ? <b className="quantity-total">Tổng: {total} {unitLabel}</b> : null}
      {submitLabel ? <button className="btn btn-secondary" disabled={locked}>{submitLabel} {quantity > 0 ? quantity : ""}</button> : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
