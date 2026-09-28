import { prisma, SectAlignment } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { applyToSectAction, cancelSectApplicationAction, createSectAction } from "@/lib/forms";
import { ActionAlert } from "@/components/ActionAlert";
import { getSectRank, sectAlignments, sectCreateCost } from "@ttg/game";
import { BadgeCheck, Castle, Crown, Search, Shield, Sparkles, Users } from "lucide-react";

const rankFilters = ["5", "4", "3", "2", "1"] as const;

export default async function SectLobbyPage({ searchParams }: { searchParams?: Promise<{ tab?: string; q?: string; filter?: string; rank?: string; sect?: string; error?: string; applied?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      sectApplications: { where: { status: "PENDING" }, include: { sect: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (character.sectId) redirect(`/game/sect/${character.sectId}`);

  const tab = params?.tab === "create" ? "create" : "list";
  const q = params?.q?.trim() ?? "";
  const rank = rankFilters.includes(params?.rank as (typeof rankFilters)[number]) ? Number(params?.rank) : undefined;
  const filter = params?.filter ?? "all";
  const alignment = filter === "RIGHTEOUS" || filter === "NEUTRAL" || filter === "DEMONIC" ? filter : undefined;
  const includeSect = {
    members: { include: { character: { include: { realmStage: { include: { realm: true } } } } }, orderBy: { joinedAt: "asc" as const } },
    applications: { where: { characterId: character.id, status: "PENDING" as const } }
  };
  const sects = await prisma.sect.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { tag: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(filter === "recruiting" ? { recruiting: true } : {}),
      ...(rank ? { rank } : {}),
      ...(alignment ? { alignment } : {})
    },
    include: includeSect,
    orderBy: [{ reputation: "desc" }, { createdAt: "asc" }],
    take: 24
  });
  const selected = params?.sect ? sects.find((sect) => sect.id === params.sect) ?? await prisma.sect.findUnique({ where: { id: params.sect }, include: includeSect }) : sects[0] ?? null;

  return (
    <div className="sect-page">
      <header className="sect-lobby-hero">
        <div>
          <p className="eyebrow">TÔNG MÔN</p>
          <h1>Tìm đạo thống hoặc khai sơn lập phái</h1>
          <p className="muted">Một sơn môn tốt là nơi có tài nguyên, người dẫn đạo và lịch sử riêng. Hãy chọn thế lực để nương tựa, hoặc tự dựng cờ.</p>
        </div>
        <div className="sect-hero-stat">
          <Shield size={22} />
          <span>Tán tu</span>
          <b>{character.name}</b>
        </div>
      </header>

      <ActionAlert message={params?.error} />
      {params?.applied ? <ActionAlert message="Đơn xin gia nhập đã được gửi tới tông môn." /> : null}

      <nav className="sect-tabs" aria-label="Tông môn">
        <a className={tab === "list" ? "active" : ""} href="/game/sect">Danh sách tông môn</a>
        <a className={tab === "create" ? "active" : ""} href="/game/sect?tab=create">Khai sơn lập phái</a>
      </nav>

      {tab === "create" ? (
        <CreateSectPanel characterLinhThach={character.linhThach} />
      ) : (
        <div className="sect-lobby-grid">
          <section className="panel sect-list-panel">
            <form className="sect-filter-bar">
              <label>
                <Search size={16} />
                <input name="q" defaultValue={q} placeholder="Tìm tên tông môn..." />
              </label>
              <select name="filter" defaultValue={filter}>
                <option value="all">Tất cả</option>
                <option value="recruiting">Đang tuyển</option>
                <option value={SectAlignment.RIGHTEOUS}>Chính đạo</option>
                <option value={SectAlignment.NEUTRAL}>Trung lập</option>
                <option value={SectAlignment.DEMONIC}>Ma đạo</option>
              </select>
              <select name="rank" defaultValue={rank ? String(rank) : ""}>
                <option value="">Mọi phẩm cấp</option>
                {rankFilters.map((value) => <option key={value} value={value}>{getSectRank(Number(value)).shortLabel}</option>)}
              </select>
              <button className="btn btn-secondary" type="submit">Lọc</button>
            </form>

            <div className="sect-card-list">
              {sects.length === 0 ? <p className="muted">Chưa tìm thấy tông môn phù hợp.</p> : sects.map((sect) => (
                <SectListCard key={sect.id} sect={sect} active={selected?.id === sect.id} />
              ))}
            </div>
          </section>

          <section className="panel sect-profile-panel">
            {selected ? <PublicSectProfile sect={selected} pendingApplicationId={character.sectApplications[0]?.id} /> : <p className="muted">Chọn một tông môn để xem sơn môn, tông chủ và điều kiện gia nhập.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function SectListCard({ sect, active }: { sect: any; active: boolean }) {
  const rank = getSectRank(sect.rank);
  const leader = sect.members.find((member: any) => member.role === "LEADER")?.character;
  return (
    <a className={`sect-list-card ${active ? "active" : ""}`} href={`/game/sect?sect=${sect.id}`}>
      <div className="sect-emblem"><Castle size={24} /></div>
      <div>
        <h2>{sect.name}</h2>
        <p className="muted">[{sect.tag}] · {rank.label} · {sectAlignments[sect.alignment as SectAlignment]}</p>
        <p>{sect.description}</p>
      </div>
      <div className="sect-list-meta">
        <span><Users size={15} /> {sect.members.length}/{sect.memberLimit}</span>
        <span><Crown size={15} /> {leader?.name ?? "Chưa rõ"}</span>
        <span><Sparkles size={15} /> {sect.reputation.toLocaleString("vi-VN")} Uy Danh</span>
      </div>
    </a>
  );
}

function PublicSectProfile({ sect, pendingApplicationId }: { sect: any; pendingApplicationId?: string | undefined }) {
  const rank = getSectRank(sect.rank);
  const leader = sect.members.find((member: any) => member.role === "LEADER")?.character;
  const alreadyApplied = sect.applications.length > 0 || Boolean(pendingApplicationId);
  return (
    <div className="sect-public-profile">
      <div className="sect-profile-head">
        <div className="sect-emblem large"><BadgeCheck size={30} /></div>
        <div>
          <p className="eyebrow">{sectAlignments[sect.alignment as SectAlignment]}</p>
          <h2>{sect.name}</h2>
          <p className="muted">[{sect.tag}] · {rank.label}</p>
        </div>
      </div>
      <blockquote>{sect.description}</blockquote>
      <div className="sect-metrics">
        <span>Tông chủ <b>{leader?.name ?? "Chưa rõ"}</b></span>
        <span>Thành viên <b>{sect.members.length}/{sect.memberLimit}</b></span>
        <span>Uy danh <b>{sect.reputation.toLocaleString("vi-VN")}</b></span>
        <span>Tuyển thành viên <b>{sect.recruiting ? "Đang mở" : "Đóng"}</b></span>
      </div>
      <p className="muted">Yêu cầu gia nhập: {sect.joinRequirement}</p>
      {alreadyApplied ? (
        <form action={cancelSectApplicationAction}>
          <input type="hidden" name="applicationId" value={sect.applications[0]?.id ?? pendingApplicationId} />
          <button className="btn btn-secondary" type="submit">Hủy đơn đang chờ</button>
        </form>
      ) : (
        <form action={applyToSectAction} className="sect-apply-form">
          <input type="hidden" name="sectId" value={sect.id} />
          <textarea name="message" className="field" placeholder="Lời nhắn xin nhập môn..." rows={3} />
          <button className="btn" type="submit" disabled={!sect.recruiting || sect.members.length >= sect.memberLimit}>Xin gia nhập</button>
        </form>
      )}
    </div>
  );
}

function CreateSectPanel({ characterLinhThach }: { characterLinhThach: bigint }) {
  const canPay = characterLinhThach >= sectCreateCost;
  return (
    <section className="sect-create-grid">
      <form action={createSectAction} className="panel sect-create-form">
        <div>
          <p className="eyebrow">KHAI SƠN LẬP PHÁI</p>
          <h2>Dựng đạo thống Ngũ Phẩm</h2>
          <p className="muted">Chi phí khai sơn: {sectCreateCost.toLocaleString("vi-VN")} Linh Thạch. Tông chủ nhận Tông Môn Đại Điện và Động Phủ Ngoại Môn cơ bản.</p>
        </div>
        <input className="field" name="name" placeholder="Tên tông môn" minLength={3} maxLength={48} required />
        <input className="field" name="tag" placeholder="Ký hiệu 2-6 ký tự" minLength={2} maxLength={6} required />
        <textarea className="field" name="description" placeholder="Tuyên ngôn / mô tả tông môn" rows={4} />
        <div className="sect-form-row">
          <select className="field" name="emblem" defaultValue="yin-yang">
            <option value="yin-yang">Âm Dương Ấn</option>
            <option value="mountain">Sơn Môn</option>
            <option value="sword">Kiếm Ấn</option>
            <option value="lotus">Liên Hoa</option>
          </select>
          <select className="field" name="alignment" defaultValue={SectAlignment.NEUTRAL}>
            <option value={SectAlignment.RIGHTEOUS}>Chính đạo</option>
            <option value={SectAlignment.NEUTRAL}>Trung lập</option>
            <option value={SectAlignment.DEMONIC}>Ma đạo</option>
          </select>
        </div>
        <button className="btn" type="submit" disabled={!canPay}>Khai sơn lập phái - {sectCreateCost.toLocaleString("vi-VN")} Linh Thạch</button>
        {!canPay ? <p className="muted">Bạn chưa đủ Linh Thạch để khai sơn.</p> : null}
      </form>
      <aside className="panel sect-create-preview">
        <p className="eyebrow">PREVIEW</p>
        <h2>Ngũ Phẩm Tông Môn</h2>
        <div className="sect-metrics">
          <span>Thành viên tối đa <b>5</b></span>
          <span>Mở khóa <b>Đại Điện</b></span>
          <span>Động phủ <b>Cơ bản</b></span>
          <span>Nhiệm vụ <b>Cơ bản</b></span>
        </div>
        <p className="muted">Sau khi tạo, bạn trở thành Tông Chủ và được đưa thẳng vào sơn môn.</p>
      </aside>
    </section>
  );
}
