import { formatEquipmentSlot, formatItemCategory, formatRarity } from "@/lib/format";
import { getItemEconomy, jsonRecord } from "@ttg/game";
import { Box, Gem, Hammer, Leaf, Pill, ScrollText, Shield, Shirt, Sparkles, Swords } from "lucide-react";
import Link from "next/link";

type ItemTemplateLike = {
  name: string;
  category: string;
  rarity: string;
  description: string;
  equipSlot?: string | null;
  tradeable: boolean;
  itemFamily?: string | null;
  baseModifiers: unknown;
  bindRules: unknown;
};

export function ItemSummaryCard({
  template,
  quantityLabel,
  priceLabel,
  href,
  selected = false,
  sellerLabel,
  action
}: {
  template: ItemTemplateLike;
  quantityLabel: string;
  priceLabel: string;
  href?: string;
  selected?: boolean;
  sellerLabel?: string;
  action?: React.ReactNode;
}) {
  const economy = getItemEconomy(template);
  const Icon = iconFor(economy.icon);
  const content = (
    <>
      <div className="item-card-visual">
        <span className={`item-icon grade-${template.rarity.toLowerCase()}`}><Icon size={34} aria-hidden /></span>
        <span className="item-stock-badge">{quantityLabel}</span>
      </div>
      <div className="item-card-body">
        <h3 className="item-name">{template.name}</h3>
        <div className="item-meta">
          <span className={`item-grade grade-${template.rarity.toLowerCase()}`}>{formatRarity(template.rarity)} Phẩm</span>
          <span>{economy.subType || formatItemCategory(template.category)}</span>
        </div>
        {sellerLabel ? <small className="item-seller">{sellerLabel}</small> : null}
      </div>
      <div className="item-card-footer">
        <b className="item-price">{priceLabel}</b>
      </div>
    </>
  );

  return (
    <article className={`market-listing-card item-shop-card ${selected ? "selected" : ""}`}>
      {href ? <Link href={href} className="item-card-link" aria-label={`Xem chi tiết ${template.name}`}>{content}</Link> : content}
      {action}
    </article>
  );
}

export function ItemDetailPanel({
  template,
  quantityLabel,
  source,
  condition,
  action
}: {
  template: ItemTemplateLike;
  quantityLabel?: string;
  source?: string;
  condition?: string;
  action?: React.ReactNode;
}) {
  const economy = getItemEconomy(template);
  const Icon = iconFor(economy.icon);
  const modifiers = Object.entries(jsonRecord(template.baseModifiers)).filter(([, value]) => typeof value === "number" || typeof value === "string" || typeof value === "boolean");
  return (
    <div className="item-detail">
      <div className="item-detail-head">
        <span className={`item-icon item-icon-large grade-${template.rarity.toLowerCase()}`}><Icon size={40} aria-hidden /></span>
        <div>
          <h3>{template.name}</h3>
          <p>{formatRarity(template.rarity)} Phẩm · {economy.subType || formatItemCategory(template.category)}</p>
        </div>
      </div>

      <section className="item-detail-section">
        <h4>Mô tả</h4>
        <p>{template.description}</p>
      </section>
      <section className="item-detail-section">
        <h4>Công dụng</h4>
        <p>{economy.usage}</p>
      </section>

      <div className="info-table mt-4">
        {quantityLabel ? <div><span>Số lượng</span><b>{quantityLabel}</b></div> : null}
        <div><span>Dòng vật phẩm</span><b>{economy.itemFamily ?? "Riêng lẻ"}</b></div>
        <div><span>Giá hệ thống</span><b>{formatCurrency(economy.systemBasePrice)} Linh Thạch</b></div>
        <div><span>Vạn Bảo Lâu thu mua</span><b>{economy.sellableToNpc ? `${formatCurrency(economy.npcBuyPrice)} Linh Thạch` : "Không thu mua"}</b></div>
        <div><span>Đổi Tông Môn</span><b>{economy.sectExchangeEnabled ? `${formatCurrency(economy.sectContributionPrice)} Cống Hiến` : "Không đổi"}</b></div>
        <div><span>Cống hiến vào kho</span><b>{economy.sectExchangeEnabled ? `${formatCurrency(economy.donationContributionValue)} Cống Hiến` : "Không nhận"}</b></div>
        <div><span>Nguồn</span><b>{source ?? "Lịch luyện, chợ, nhiệm vụ hoặc tông môn"}</b></div>
        <div><span>Điều kiện</span><b>{condition ?? formatCondition(economy.requiredRealmOrder, economy.requiredSectRank)}</b></div>
      </div>

      {modifiers.length > 0 ? (
        <div className="item-stat-list">
          {modifiers.map(([key, value]) => <span key={key}>{formatModifier(key)} <b>{formatModifierValue(value)}</b></span>)}
        </div>
      ) : null}

      {action ? <div className="item-actions mt-4">{action}</div> : null}
    </div>
  );
}

export function formatCurrency(value: bigint | number) {
  return value.toLocaleString("vi-VN");
}

function formatCondition(requiredRealmOrder: number | null, requiredSectRank: number | null) {
  const parts = [];
  if (requiredRealmOrder !== null) parts.push(`Cảnh giới bậc ${requiredRealmOrder}+`);
  if (requiredSectRank !== null) parts.push(`Tông Môn ${requiredSectRank} phẩm trở lên`);
  return parts.length ? parts.join(" · ") : "Không";
}

function formatModifier(key: string) {
  return ({ attack: "Công kích", defense: "Phòng ngự", speed: "Tốc độ", spirit: "Thần thức", hp: "Sinh lực", qi: "Chân nguyên", hpRestore: "Hồi sinh lực", qiRestore: "Hồi chân nguyên", cultivation: "Tu vi", cultivationBps: "Tốc độ tu luyện", breakthroughBps: "Đột phá" } as Record<string, string>)[key] ?? key;
}

function formatModifierValue(value: unknown) {
  if (typeof value === "number") return value > 0 ? `+${value}` : value.toString();
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return String(value);
}

function iconFor(icon: string) {
  return ({
    herb: Leaf,
    leaf: Leaf,
    ore: Hammer,
    wood: Leaf,
    core: Sparkles,
    crystal: Gem,
    hide: Shirt,
    fang: Swords,
    bone: Box,
    silk: Sparkles,
    sword: Swords,
    armor: Shirt,
    boots: Shield,
    ring: Gem,
    talisman: ScrollText,
    pill: Pill,
    manual: ScrollText,
    scroll: ScrollText,
    gem: Gem,
    box: Box
  } as const)[icon] ?? Box;
}
