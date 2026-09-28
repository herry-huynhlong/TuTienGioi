import { prisma } from "@ttg/db";
import { formatLocationKind, formatSecurity } from "@/lib/format";

export default async function AdminWorldPage() {
  const [regions, locations, monsters] = await Promise.all([
    prisma.region.findMany({ include: { zones: true }, orderBy: { order: "asc" } }),
    prisma.location.findMany({ include: { zone: { include: { region: true } } }, orderBy: { name: "asc" } }),
    prisma.monster.findMany({ orderBy: [{ realmOrder: "asc" }, { name: "asc" }] })
  ]);
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">World Admin</p><h1>Thế Giới</h1></div></header>
      <section className="admin-stat-grid">
        <div className="panel rounded-lg p-4"><p className="muted">Regions</p><b>{regions.length}</b></div>
        <div className="panel rounded-lg p-4"><p className="muted">Locations</p><b>{locations.length}</b></div>
        <div className="panel rounded-lg p-4"><p className="muted">Monsters</p><b>{monsters.length}</b></div>
      </section>
      <section className="admin-table-wrap mt-5">
        <table className="admin-table"><thead><tr><th>Location</th><th>Region</th><th>Loại</th><th>An ninh</th><th>Services</th><th>Active</th></tr></thead><tbody>
          {locations.map((loc) => <tr key={loc.id}><td><b>{loc.name}</b><small>{loc.key}</small></td><td>{loc.zone.region?.name ?? "Không rõ"} · {loc.zone.name}</td><td>{formatLocationKind(loc.kind)}</td><td>{formatSecurity(loc.securityLevel)}</td><td>{loc.services.join(", ")}</td><td>{loc.active ? "Có" : "Không"}</td></tr>)}
        </tbody></table>
      </section>
      <section className="admin-table-wrap mt-5">
        <table className="admin-table"><thead><tr><th>Monster</th><th>Bậc</th><th>HP</th><th>Attack</th><th>Loot</th></tr></thead><tbody>
          {monsters.map((m) => <tr key={m.id}><td><b>{m.name}</b><small>{m.key}</small></td><td>{m.realmOrder}</td><td>{m.hp}</td><td>{m.attack}</td><td><code>{JSON.stringify(m.lootTable)}</code></td></tr>)}
        </tbody></table>
      </section>
    </div>
  );
}
