import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { recordOnboardingEvent } from "@ttg/game";

export default async function MarketPage() {
  const user = await getUser();
  const character = await prisma.character.findUnique({ where: { userId: user!.id }, select: { id: true } });
  if (character) await recordOnboardingEvent(prisma, character.id, "VIEW_MARKET");
  const listings = await prisma.marketListing.findMany({ where: { status: "ACTIVE" }, take: 30, include: { item: { include: { template: true } }, seller: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-3xl font-black">Chợ</h1>
      <section className="panel mt-6 overflow-x-auto rounded-lg p-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-gold"><tr><th>Vật phẩm</th><th>Người bán</th><th>SL</th><th>Giá</th><th>Hết hạn</th></tr></thead>
          <tbody>{listings.map((l) => <tr key={l.id} className="border-t border-white/10"><td className="py-3">{l.item.template.name}</td><td>{l.seller.name}</td><td>{l.quantity}</td><td>{l.price.toString()}</td><td>{l.expiresAt.toLocaleString("vi-VN")}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
