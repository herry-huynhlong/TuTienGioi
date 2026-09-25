import { ItemCategory, prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { recordOnboardingEvent } from "@ttg/game";

const categories = [
  ["", "Tất cả"],
  [ItemCategory.MATERIAL, "Tài nguyên"],
  [ItemCategory.CONSUMABLE, "Đan dược"],
  [ItemCategory.EQUIPMENT, "Trang bị"],
  [ItemCategory.TECHNIQUE, "Công pháp"],
  [ItemCategory.QUEST, "Nhiệm vụ"]
];

export default async function MarketPage({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string }> }) {
  const user = await getUser();
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const category = categories.some(([value]) => value === params?.category) ? params?.category : "";
  const character = await prisma.character.findUnique({ where: { userId: user!.id }, select: { id: true, linhThach: true } });
  if (character) await recordOnboardingEvent(prisma, character.id, "VIEW_MARKET");
  const listings = await prisma.marketListing.findMany({
    where: {
      status: "ACTIVE",
      item: {
        template: {
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
          ...(category ? { category: category as ItemCategory } : {})
        }
      }
    },
    take: 30,
    include: { item: { include: { template: true } }, seller: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Kinh tế người chơi</p>
        <h1 className="mt-1 text-3xl font-black">Chợ</h1>
        <p className="muted mt-2">Tra cứu vật phẩm đang bán, so giá và chuẩn bị tài nguyên cho tu luyện.</p>
      </header>

      <section className="panel rounded-lg p-5">
        <form className="market-toolbar">
          <input className="field" name="q" placeholder="Tìm vật phẩm..." defaultValue={q} />
          <select className="field" name="category" defaultValue={category}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn">Tìm</button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="muted">{listings.length} vật phẩm đang khớp bộ lọc</span>
          <span className="text-gold">Linh thạch: {character?.linhThach.toString() ?? "0"}</span>
        </div>
      </section>

      <section className="panel mt-5 overflow-x-auto rounded-lg p-4">
        {listings.length > 0 ? (
          <table className="market-table">
            <thead>
              <tr><th>Vật phẩm</th><th>Loại</th><th>Người bán</th><th>SL</th><th>Giá</th><th>Hết hạn</th></tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.item.template.name}</b>
                    <small>{l.item.template.rarity} · +{l.item.enhancement}</small>
                  </td>
                  <td>{l.item.template.category}</td>
                  <td>{l.seller.name}</td>
                  <td>{l.quantity}</td>
                  <td className="text-gold">{l.price.toString()}</td>
                  <td>{l.expiresAt.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <b>Chưa có vật phẩm phù hợp.</b>
            <p>Thử bỏ bộ lọc hoặc quay lại sau khi người chơi khác đăng bán. Luồng đăng bán riêng sẽ được nối ở phần kinh tế tiếp theo.</p>
          </div>
        )}
      </section>
    </div>
  );
}
