"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Gem, Landmark } from "lucide-react";

type ExchangeAction = (formData: FormData) => void | Promise<void>;

const rate = 10n;
const presets = [10n, 50n, 100n, 500n] as const;

export function HeavenlyTreasuryExchange({ balanceTienNgoc, action }: { balanceTienNgoc: string; action: ExchangeAction }) {
  const balance = useMemo(() => {
    try {
      return BigInt(balanceTienNgoc);
    } catch {
      return 0n;
    }
  }, [balanceTienNgoc]);
  const [selected, setSelected] = useState<bigint>(balance >= 10n ? 10n : balance);
  const [actionKey] = useState(() => crypto.randomUUID());
  const options = presets.filter((amount) => amount <= balance);
  const canExchange = selected > 0n && selected <= balance;
  const received = selected * rate;

  return (
    <section className="heavenly-panel heavenly-exchange-panel">
      <div className="heavenly-panel-head">
        <div>
          <p>Đổi Linh Thạch</p>
          <h2>Ngọc chuyển thành tài</h2>
        </div>
        <ArrowRightLeft size={22} />
      </div>
      <p className="muted">Tỷ lệ cố định hiện tại: 1 Tiên Ngọc = 10 Linh Thạch. Không hỗ trợ đổi ngược.</p>
      <div className="heavenly-rate-card">
        <span><Gem size={16} /> 1 Tiên Ngọc</span>
        <b>=</b>
        <span><Landmark size={16} /> 10 Linh Thạch</span>
      </div>
      <div className="heavenly-choice-grid">
        {options.map((amount) => (
          <button key={amount.toString()} type="button" className={selected === amount ? "active" : ""} onClick={() => setSelected(amount)}>
            {amount.toLocaleString("vi-VN")}
          </button>
        ))}
        <button type="button" className={selected === balance && balance > 0n ? "active" : ""} disabled={balance <= 0n} onClick={() => setSelected(balance)}>
          Tối đa
        </button>
      </div>
      <form action={action} className="heavenly-exchange-confirm">
        <input type="hidden" name="amount" value={selected.toString()} />
        <input type="hidden" name="actionKey" value={actionKey} />
        <div>
          <span>Đổi</span>
          <b>{selected.toLocaleString("vi-VN")} Tiên Ngọc</b>
        </div>
        <div>
          <span>Nhận</span>
          <b>{received.toLocaleString("vi-VN")} Linh Thạch</b>
        </div>
        <button className="btn" disabled={!canExchange}>Xác nhận đổi</button>
      </form>
      {!canExchange ? <p className="heavenly-hint">Bạn chưa có đủ Tiên Ngọc để đổi.</p> : null}
    </section>
  );
}
