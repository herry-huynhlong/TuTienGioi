import { prisma } from "@ttg/db";

export default async function LeaderboardPage() {
  const rows = await prisma.character.findMany({ take: 50, orderBy: [{ cultivation: "desc" }, { reputation: "desc" }], include: { realmStage: { include: { realm: true } }, sect: true } });
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-3xl font-black">Xếp Hạng</h1>
      <section className="panel mt-6 overflow-x-auto rounded-lg p-4">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-gold"><tr><th>#</th><th>Nhân vật</th><th>Cảnh giới</th><th>Tu vi</th><th>Tông môn</th><th>Danh vọng</th></tr></thead>
          <tbody>{rows.map((c, i) => <tr key={c.id} className="border-t border-white/10"><td className="py-3">{i + 1}</td><td>{c.name}</td><td>{c.realmStage.realm.name} {c.realmStage.name}</td><td>{c.cultivation.toString()}</td><td>{c.sect?.name ?? "Tán tu"}</td><td>{c.reputation}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
