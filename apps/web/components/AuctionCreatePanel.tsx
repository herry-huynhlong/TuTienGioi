"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createAuctionAction } from "@/lib/forms";
import { formatRarity } from "@/lib/format";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { ItemDetailPanel, ItemVisual } from "@/components/ItemCard";

type AuctionItem = {
  id: string;
  quantity: number;
  bound: boolean;
  equippedSlot: string | null;
  template: {
    key: string;
    name: string;
    category: string;
    rarity: string;
    description: string;
    equipSlot: string | null;
    tradeable: boolean;
    stackable: boolean;
    itemFamily?: string | null;
    baseModifiers: unknown;
    bindRules: unknown;
  };
  listings: { id: string }[];
  auctions: { id: string }[];
};

export function AuctionCreatePanel({
  items,
  selectedItem,
  feeBps,
  registrationDays,
  liveDays
}: {
  items: Array<AuctionItem & { auctionDisabledReason?: string }>;
  selectedItem: AuctionItem | undefined;
  feeBps: number;
  registrationDays: number;
  liveDays: number;
}) {
  return (
    <section className="auction-create-layout">
      <div className="panel rounded-lg p-5">
        <p className="text-xs font-bold uppercase text-jade">Đưa vật phẩm lên đấu giá</p>
        <h2 className="mt-1 text-xl font-black text-gold">Bước 1: Chọn vật phẩm</h2>
        <div className="auction-step-list mt-3">
          <span>1. Chọn vật phẩm</span>
          <span>2. Chọn số lượng</span>
          <span>3. Đặt giá</span>
          <span>4. Xác nhận đăng ký</span>
        </div>
        <div className="auction-item-grid mt-4">
          {items.map((item) => item.auctionDisabledReason ? (
            <div key={item.id} className="auction-item-option disabled" title={item.auctionDisabledReason}>
              <ItemVisual template={item.template} size="card" />
              <b>{item.template.name}</b>
              <small>{formatRarity(item.template.rarity)} Phẩm · x{item.quantity}</small>
              <em>{item.auctionDisabledReason}</em>
            </div>
          ) : (
            <Link key={item.id} href={`/game/auction?tab=sell&sellItem=${item.id}`} className={`auction-item-option ${selectedItem?.id === item.id ? "selected" : ""}`}>
              <ItemVisual template={item.template} size="card" />
              <b>{item.template.name}</b>
              <small>{formatRarity(item.template.rarity)} Phẩm · x{item.quantity}</small>
            </Link>
          ))}
          {items.length === 0 ? <p className="muted">Túi đồ chưa có vật phẩm nào.</p> : null}
        </div>
      </div>

      <div className="panel rounded-lg p-5">
        {selectedItem ? <AuctionRegisterForm item={selectedItem} feeBps={feeBps} registrationDays={registrationDays} liveDays={liveDays} /> : <p className="muted">Chọn vật phẩm đủ điều kiện để đăng ký đấu giá.</p>}
      </div>
    </section>
  );
}

function AuctionRegisterForm({ item, feeBps, registrationDays, liveDays }: { item: AuctionItem; feeBps: number; registrationDays: number; liveDays: number }) {
  const maxQuantity = item.template.stackable ? item.quantity : 1;
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("100000");
  const [confirming, setConfirming] = useState(false);
  const [transactionKey] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  });
  const startingPrice = /^\d+$/.test(price) ? BigInt(price) : 0n;
  const fee = auctionFee(startingPrice, feeBps);
  const maxReceive = startingPrice > fee ? startingPrice - fee : startingPrice;
  const safeQuantity = clamp(quantity, 1, maxQuantity);

  const details = useMemo(() => [
    { label: "Hạng", value: `${formatRarity(item.template.rarity)} Phẩm` },
    { label: "Số lượng có", value: `x${item.quantity}` },
    { label: "Mua ngay", value: "Chưa dùng ở phiên bản hiện tại" },
    { label: "Đăng ký lúc", value: "Ngay khi xác nhận" },
    { label: "Mở đấu sau", value: `${registrationDays} ngày game` },
    { label: "Thời gian đấu tối đa", value: `${liveDays} ngày game` }
  ], [item, registrationDays, liveDays]);

  return (
    <div className="auction-register-panel">
      <ItemDetailPanel template={item.template} quantityLabel={`x${item.quantity}`} details={details} showModifiers />
      <div className="auction-register-form">
        <label>
          Bước 2: Chọn số lượng
          <div className="quantity-control mt-2">
            <button type="button" disabled={safeQuantity <= 1} onClick={() => setQuantity((value) => clamp(value - 1, 1, maxQuantity))}>-</button>
            <input className="field" type="number" min={1} max={maxQuantity} value={safeQuantity} disabled={maxQuantity === 1} onChange={(event) => setQuantity(clamp(Number(event.target.value || 1), 1, maxQuantity))} />
            <button type="button" disabled={safeQuantity >= maxQuantity} onClick={() => setQuantity((value) => clamp(value + 1, 1, maxQuantity))}>+</button>
          </div>
        </label>
        <label>
          Bước 3: Giá khởi điểm
          <input className="field mt-2" inputMode="numeric" pattern="[0-9]+" min="1" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))} />
        </label>
        <div className="auction-fee-preview">
          <span>Giá khởi điểm <b><CurrencyAmount amount={startingPrice} /></b></span>
          <span>Phí đăng {feeBps / 100}% <b><CurrencyAmount amount={fee} /></b></span>
          <span>Bạn nhận tối đa <b><CurrencyAmount amount={maxReceive} /></b></span>
        </div>
        <button className="btn w-full" type="button" disabled={startingPrice <= 0n} onClick={() => setConfirming(true)}>Đăng ký đấu giá</button>
      </div>

      {confirming ? (
        <div className="auction-confirm-backdrop" role="dialog" aria-modal="true">
          <form action={createAuctionAction} className="auction-confirm-modal">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="quantity" value={safeQuantity} />
            <input type="hidden" name="startingPrice" value={startingPrice.toString()} />
            <input type="hidden" name="transactionKey" value={transactionKey} />
            <h3>Xác nhận đăng ký đấu giá</h3>
            <p>Bạn muốn đưa lên đấu giá:</p>
            <b>{item.template.name} x{safeQuantity}</b>
            <div className="info-table mt-4">
              <div><span>Giá khởi điểm</span><b><CurrencyAmount amount={startingPrice} /></b></div>
              <div><span>Phí đăng</span><b><CurrencyAmount amount={fee} /></b></div>
              <div><span>Mở đấu sau</span><b>{registrationDays} ngày game</b></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SubmitButton />
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>Hủy</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Đang đăng ký..." : "Xác nhận"}</button>;
}

function auctionFee(price: bigint, feeBps: number) {
  if (price <= 0n || feeBps <= 0) return 0n;
  const fee = (price * BigInt(Math.floor(feeBps))) / 10000n;
  return fee > 0n ? fee : 1n;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
