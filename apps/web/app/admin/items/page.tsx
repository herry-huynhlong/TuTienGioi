import Link from "next/link";
import { ItemCategory, Rarity, prisma } from "@ttg/db";
import { getItemEconomy, jsonRecord } from "@ttg/game";
import { formatCurrency } from "@/components/ItemCard";
import { formatItemCategory, formatRarity } from "@/lib/format";

export default async function AdminItemsPage({ searchParams }: { searchParams?: Promise<{ q?: string; rarity?: string; category?: string; market?: string; sect?: string }> }) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const rarity = Object.values(Rarity).includes(params?.rarity as Rarity) ? params?.rarity as Rarity : undefined;
  const category = Object.values(ItemCategory).includes(params?.category as ItemCategory) ? params?.category as ItemCategory : undefined;
  const items = await prisma.itemTemplate.findMany({
    where: { ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { key: { contains: q, mode: "insensitive" } }] } : {}), ...(rarity ? { rarity } : {}), ...(category ? { category } : {}) },
    orderBy: [{ rarity: "asc" }, { category: "asc" }, { name: "asc" }],
    take: 120
  });
  const filtered = items.filter((item) => {
    const economy = getItemEconomy(item);
    if (params?.market === "system" && !economy.systemMarketEnabled) return false;
    if (params?.market === "auction" && !economy.auctionEligible) return false;
    if (params?.sect === "enabled" && !economy.sectExchangeEnabled) return false;
    if (params?.sect === "disabled" && economy.sectExchangeEnabled) return false;
    return true;
  });
  return (
    <div>
      <header className="admin-page-head">
        <div><p className="eyebrow">Item Management</p><h1>Vật Phẩm</h1></div>
        <Link href="/admin/items/new" className="btn">Thêm vật phẩm</Link>
      </header>
      <form className="admin-filter-bar">
        <input className="field" name="q" placeholder="Search name/key..." defaultValue={q} />
        <select className="field" name="rarity" defaultValue={rarity ?? ""}><option value="">Mọi phẩm</option>{Object.values(Rarity).map((v) => <option key={v}>{v}</option>)}</select>
        <select className="field" name="category" defaultValue={category ?? ""}><option value="">Mọi category</option>{Object.values(ItemCategory).map((v) => <option key={v}>{v}</option>)}</select>
        <select className="field" name="market" defaultValue={params?.market ?? ""}><option value="">Market bất kỳ</option><option value="system">System market</option><option value="auction">Auction</option></select>
        <select className="field" name="sect" defaultValue={params?.sect ?? ""}><option value="">Sect bất kỳ</option><option value="enabled">Có đổi Tông Môn</option><option value="disabled">Không đổi</option></select>
        <button className="btn btn-secondary">Lọc</button>
      </form>
      <div className="admin-table-wrap mt-5">
        <table className="admin-table">
          <thead><tr><th>Ảnh</th><th>Tên</th><th>Key</th><th>Phẩm</th><th>Category</th><th>Giá</th><th>Market</th><th>Sect</th><th /></tr></thead>
          <tbody>
            {filtered.map((item) => {
              const economy = getItemEconomy(item);
              const meta = jsonRecord(item.bindRules);
              const image = typeof meta.imageUrl === "string" && meta.imageUrl ? meta.imageUrl : `/items/${item.key}.svg`;
              return (
                <tr key={item.id}>
                  <td><img className="admin-item-thumb" src={image} alt="" /></td>
                  <td><b>{item.name}</b>{!meta.imageUrl ? <small>Chưa có ảnh upload riêng</small> : null}</td>
                  <td>{item.key}</td>
                  <td>{formatRarity(item.rarity)} Phẩm</td>
                  <td>{formatItemCategory(item.category)}</td>
                  <td>{formatCurrency(economy.systemBasePrice)}</td>
                  <td>{economy.systemMarketEnabled ? "System" : economy.marketEnabled ? "Player" : "Tắt"}</td>
                  <td>{economy.sectExchangeEnabled ? `${economy.sectContributionPrice} CH` : "Tắt"}</td>
                  <td><Link className="btn btn-secondary" href={`/admin/items/${item.id}`}>Edit</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
