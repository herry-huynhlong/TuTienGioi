import { formatItemCategory, formatRarity } from "@/lib/format";
import { getItemEconomy, itemVisualFallbackKey, itemVisualKey, jsonRecord } from "@ttg/game";
import { Box, Gem, Hammer, Leaf, Pill, ScrollText, Shield, Shirt, Sparkles, Swords } from "lucide-react";
import Link from "next/link";
import { ItemVisualImage } from "./ItemVisualImage";

type ItemTemplateLike = {
  key?: string;
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
  priceLabel: React.ReactNode;
  href?: string;
  selected?: boolean;
  sellerLabel?: string;
  action?: React.ReactNode;
}) {
  const economy = getItemEconomy(template);
  const content = (
    <>
      <div className="item-card-visual">
        <ItemVisual template={template} size="card" />
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
  details,
  showModifiers = true,
  action
}: {
  template: ItemTemplateLike;
  quantityLabel?: string;
  source?: string;
  condition?: string;
  details?: Array<{ label: string; value: React.ReactNode }>;
  showModifiers?: boolean;
  action?: React.ReactNode;
}) {
  const economy = getItemEconomy(template);
  const modifiers = Object.entries(jsonRecord(template.baseModifiers)).filter(([, value]) => typeof value === "number" || typeof value === "string" || typeof value === "boolean");
  const rows = details ?? [
    ...(quantityLabel ? [{ label: "Số lượng", value: quantityLabel }] : []),
    { label: "Điều kiện", value: condition ?? formatCondition(economy.requiredRealmOrder, economy.requiredSectRank) },
    ...(source ? [{ label: "Nguồn", value: source }] : [])
  ];
  return (
    <div className="item-detail">
      <div className="item-detail-head">
        <ItemVisual template={template} size="detail" />
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

      {rows.length > 0 ? (
        <div className="info-table mt-4">
          {rows.map((row) => <div key={row.label}><span>{row.label}</span><b>{row.value}</b></div>)}
        </div>
      ) : null}

      {showModifiers && modifiers.length > 0 ? (
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

export function ItemVisual({ template, size }: { template: ItemTemplateLike; size: "card" | "detail" }) {
  const economy = getItemEconomy(template);
  const { src, fallbackSrc } = visualSrc(template);
  const className = `item-visual ${size === "detail" ? "item-visual-large" : ""} grade-${template.rarity.toLowerCase()}`;
  if (src) return <ItemVisualImage className={className} src={src} fallbackSrc={fallbackSrc} />;
  const Icon = iconFor(economy.icon);
  return <span className={className}><Icon size={size === "detail" ? 44 : 34} aria-hidden /></span>;
}

function visualSrc(template: ItemTemplateLike) {
  const meta = jsonRecord(template.bindRules);
  const economy = getItemEconomy(template);
  const fallbackKey = itemVisualFallbackKey({ category: template.category, icon: economy.icon, equipSlot: template.equipSlot });
  if (typeof meta.imageUrl === "string" && meta.imageUrl && !isLegacyGeneratedSvg(meta.imageUrl)) return { src: meta.imageUrl, fallbackSrc: `/items/${fallbackKey}.webp` };
  const visualKey = typeof meta.visualKey === "string" && meta.visualKey ? meta.visualKey : economy.visualKey || itemVisualKey({ key: template.key, category: template.category, icon: economy.icon, equipSlot: template.equipSlot });
  return { src: `/items/${visualKey}.webp`, fallbackSrc: `/items/${fallbackKey}.webp` };
}

function isLegacyGeneratedSvg(value: string) {
  return value.startsWith("/items/") && value.endsWith(".svg");
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
