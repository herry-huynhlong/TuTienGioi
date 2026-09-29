import { prisma } from "@ttg/db";
import { currentSystemMarketPeriod } from "@ttg/game";
import { formatCurrency } from "@/components/ItemCard";
import { ActionAlert } from "@/components/ActionAlert";
import { adjustSystemMarketStockAction, refreshAdminMarketStockAction } from "@/lib/admin-actions";

export default async function AdminMarketPage({ searchParams }: { searchParams?: Promise<{ ok?: string; error?: string }> }) {
  const query = await searchParams;
  const periodKey = currentSystemMarketPeriod();
  const stocks = await prisma.systemMarketStock.findMany({ where: { periodKey }, include: { template: true }, orderBy: [{ template: { rarity: "asc" } }, { template: { name: "asc" } }] });
  return (
    <div>
      <header className="admin-page-head">
        <div><p className="eyebrow">Market Admin</p><h1>Vạn Bảo Lâu</h1><p className="muted">Kỳ stock: {periodKey}</p></div>
        <form action={refreshAdminMarketStockAction}><button className="btn">Làm mới vật phẩm</button></form>
      </header>
      <ActionAlert message={query?.error ?? (query?.ok ? "Đã xử lý market." : undefined)} />
      <div className="admin-table-wrap mt-5">
        <table className="admin-table">
          <thead><tr><th>Item</th><th>Phẩm</th><th>Stock</th><th>Giá</th><th>Điều chỉnh</th></tr></thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.id}>
                <td><b>{stock.template.name}</b><small>{stock.template.key}</small></td>
                <td>{stock.template.rarity}</td>
                <td>{stock.stock.toLocaleString("vi-VN")}</td>
                <td>{formatCurrency(stock.price)} Linh Thạch</td>
                <td>
                  <form action={adjustSystemMarketStockAction} className="admin-inline-form">
                    <input type="hidden" name="stockId" value={stock.id} />
                    <input className="field" name="delta" placeholder="+10 / -10" inputMode="numeric" />
                    <input className="field" name="reason" placeholder="Lý do" required />
                    <button className="btn btn-secondary">Áp dụng</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
