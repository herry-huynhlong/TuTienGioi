import { prisma } from "@ttg/db";
import { ActionAlert } from "@/components/ActionAlert";
import { updateSectAdminAction } from "@/lib/admin-actions";

export default async function AdminSectsPage({ searchParams }: { searchParams?: Promise<{ ok?: string; error?: string }> }) {
  const query = await searchParams;
  const sects = await prisma.sect.findMany({ include: { members: { include: { character: true } } }, orderBy: [{ rank: "asc" }, { reputation: "desc" }] });
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">Sect Admin</p><h1>Tông Môn</h1></div></header>
      <ActionAlert message={query?.error ?? (query?.ok ? "Đã cập nhật Tông Môn." : undefined)} />
      <div className="admin-card-list mt-5">
        {sects.map((sect) => (
          <form key={sect.id} action={updateSectAdminAction} className="panel rounded-lg p-5 admin-form compact">
            <input type="hidden" name="sectId" value={sect.id} />
            <h2>{sect.name} [{sect.tag}]</h2>
            <p className="muted">Thành viên {sect.members.length}/{sect.memberLimit} · Tông Chủ {sect.members.find((m) => m.role === "LEADER")?.character.name ?? "Không rõ"}</p>
            <label>Tên<input className="field" name="name" defaultValue={sect.name} /></label>
            <label>Mô tả<textarea className="field" name="description" defaultValue={sect.description} rows={2} /></label>
            <label>Rank<input className="field" name="rank" inputMode="numeric" defaultValue={sect.rank} /></label>
            <label>Uy danh<input className="field" name="reputation" inputMode="numeric" defaultValue={sect.reputation} /></label>
            <label>Quỹ<input className="field" name="treasury" inputMode="numeric" defaultValue={sect.treasury.toString()} /></label>
            <label>Lý do<input className="field" name="reason" required defaultValue="Admin chỉnh dữ liệu tông môn" /></label>
            <button className="btn btn-secondary">Lưu Tông Môn</button>
          </form>
        ))}
      </div>
    </div>
  );
}
