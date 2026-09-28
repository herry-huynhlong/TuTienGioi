import { Currency, prisma } from "@ttg/db";
import { ActionAlert } from "@/components/ActionAlert";
import { adjustCharacterCurrencyAction, grantItemToCharacterAction } from "@/lib/admin-actions";

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const query = await searchParams;
  const q = query?.q?.trim() ?? "";
  const [users, items] = await Promise.all([
    prisma.user.findMany({
      where: q ? { OR: [{ username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { character: { name: { contains: q, mode: "insensitive" } } }] } : {},
      include: { character: { include: { realmStage: { include: { realm: true } }, currentLocation: true, sect: true, items: { take: 5, include: { template: true } } } } },
      take: 40,
      orderBy: { createdAt: "desc" }
    }),
    prisma.itemTemplate.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">User Admin</p><h1>Người Chơi</h1></div></header>
      <ActionAlert message={query?.error ?? (query?.ok ? "Đã xử lý người chơi." : undefined)} />
      <form className="admin-filter-bar"><input className="field" name="q" placeholder="username/email/character" defaultValue={q} /><button className="btn btn-secondary">Tìm</button></form>
      <div className="admin-card-list mt-5">
        {users.map((user) => user.character ? (
          <article key={user.id} className="panel rounded-lg p-5 admin-user-card">
            <div>
              <h2>{user.username}</h2>
              <p className="muted">{user.email} · {user.role} · {user.status}</p>
              <p>{user.character.name} · {user.character.realmStage.realm.name} {user.character.realmStage.name} · {user.character.currentLocation?.name ?? "Không rõ"}</p>
              <p className="text-gold">Linh Thạch {user.character.linhThach.toLocaleString("vi-VN")} · Tiên Ngọc {user.character.tienNgoc.toLocaleString("vi-VN")}</p>
            </div>
            <form action={grantItemToCharacterAction} className="admin-inline-form">
              <input type="hidden" name="characterId" value={user.character.id} />
              <select className="field" name="templateId">{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <input className="field" name="quantity" defaultValue="1" inputMode="numeric" />
              <input className="field" name="reason" placeholder="Lý do grant item" required />
              <button className="btn btn-secondary">Grant item</button>
            </form>
            <form action={adjustCharacterCurrencyAction} className="admin-inline-form">
              <input type="hidden" name="characterId" value={user.character.id} />
              <select className="field" name="currency">{Object.values(Currency).map((c) => <option key={c}>{c}</option>)}</select>
              <input className="field" name="amount" placeholder="+1000 / -500" inputMode="numeric" />
              <input className="field" name="reason" placeholder="Lý do chỉnh tiền" required />
              <button className="btn btn-secondary">Chỉnh tiền</button>
            </form>
          </article>
        ) : null)}
      </div>
    </div>
  );
}
