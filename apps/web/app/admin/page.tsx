import Link from "next/link";
import { prisma } from "@ttg/db";

export default async function AdminPage() {
  const [users, characters, items, marketStock, sects, missions, audits] = await Promise.all([
    prisma.user.count(),
    prisma.character.count(),
    prisma.itemTemplate.count(),
    prisma.systemMarketStock.count({ where: { stock: { gt: 0 } } }),
    prisma.sect.count(),
    prisma.sectMission.count({ where: { status: "ACTIVE" } }),
    prisma.adminAuditLog.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { actor: true } })
  ]);
  return (
    <div>
      <header className="admin-page-head">
        <div>
          <p className="eyebrow">Control Panel</p>
          <h1>Admin Dashboard</h1>
        </div>
        <Link href="/admin/items/new" className="btn">Thêm vật phẩm</Link>
      </header>
      <section className="admin-stat-grid">
        <Stat label="Users" value={users} />
        <Stat label="Characters" value={characters} />
        <Stat label="Item templates" value={items} />
        <Stat label="Market stock" value={marketStock} />
        <Stat label="Tông Môn" value={sects} />
        <Stat label="Mission active" value={missions} />
      </section>
      <section className="panel rounded-lg p-5 mt-5">
        <h2 className="text-xl font-bold text-gold">Admin actions gần đây</h2>
        <div className="admin-log-list mt-4">
          {audits.map((log) => <p key={log.id}><b>{log.action}</b><span>{log.actor.username} · {log.target} · {log.createdAt.toLocaleString("vi-VN")}</span></p>)}
          {audits.length === 0 ? <p className="muted">Chưa có audit log.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="panel rounded-lg p-4"><p className="muted text-sm">{label}</p><b className="admin-stat-value">{value.toLocaleString("vi-VN")}</b></div>;
}
