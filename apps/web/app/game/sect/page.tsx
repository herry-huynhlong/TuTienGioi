import { prisma, SectAlignment } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { applyToSectAction, cancelSectApplicationAction, completeThanhVanAdmissionAction, createSectAction, revealThanhVanSpiritualRootAction } from "@/lib/forms";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { getSectRank, progressQuestEvent, sectAlignments, sectCreateCost } from "@ttg/game";
import { SectEmblem } from "@/components/SectEmblem";
import { CharacterVisual } from "@/components/CharacterVisual";
import { BookOpen, Building2, Crown, Gem, ScrollText, Search, Shield, Sparkles, Users } from "lucide-react";

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
  await progressQuestEvent(prisma, { characterId: character.id, eventType: "VISIT_SECT_PAGE", amount: 1 });

  const tab = params?.tab === "create" ? "create" : "list";
  const q = params?.q?.trim() ?? "";
  const rank = rankFilters.includes(params?.rank as (typeof rankFilters)[number]) ? Number(params?.rank) : undefined;
  const filter = params?.filter ?? "all";
  const alignment = filter === "RIGHTEOUS" || filter === "NEUTRAL" || filter === "DEMONIC" ? filter : undefined;
  const includeSect = {
    members: { include: { character: { include: { realmStage: { include: { realm: true } } } } }, orderBy: { joinedAt: "asc" as const } },
    applications: { where: { characterId: character.id, status: "PENDING" as const } },
    buildings: { orderBy: [{ level: "desc" as const }, { name: "asc" as const }] },
    missions: { where: { status: "ACTIVE" as const }, orderBy: [{ difficulty: "asc" as const }, { title: "asc" as const }], take: 6 },
    libraryTechniques: { include: { technique: true }, orderBy: { createdAt: "desc" as const }, take: 6 }
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
      <SectEmblem iconKey={sect.iconKey} size="md" />
      <div>
        <h2>{sect.name}</h2>
        <p className="muted">[{sect.tag}] · {rank.label} · Cấp {sect.level} · {sectAlignments[sect.alignment as SectAlignment]}</p>
        <p>{sect.description}</p>
      </div>
      <div className="sect-list-meta">
        <span><Users size={15} /> {sect.members.length}/{sect.memberLimit}</span>
        <span><Crown size={15} /> {leader?.name ?? "Chưa rõ"}</span>
        <span><Sparkles size={15} /> {sect.reputation.toLocaleString("vi-VN")} Uy Danh</span>
        <span><Gem size={15} /> {Number(sect.treasury).toLocaleString("vi-VN")} Linh Thạch</span>
        <span><Shield size={15} /> {sect.recruiting ? "Đang tuyển" : "Đóng tuyển"}</span>
      </div>
    </a>
  );
}

function PublicSectProfile({ sect, pendingApplicationId }: { sect: any; pendingApplicationId?: string | undefined }) {
  const rank = getSectRank(sect.rank);
  const leader = sect.members.find((member: any) => member.role === "LEADER")?.character;
  const alreadyApplied = sect.applications.length > 0 || Boolean(pendingApplicationId);
  const seniorMembers = [...sect.members].sort((a: any, b: any) => roleWeight(a.role) - roleWeight(b.role) || b.contribution - a.contribution).slice(0, 15);
  return (
    <div className="sect-public-profile">
      <div className="sect-profile-head">
        <SectEmblem iconKey={sect.iconKey} size="lg" />
        <div>
          <p className="eyebrow">{sectAlignments[sect.alignment as SectAlignment]}</p>
          <h2>{sect.name}</h2>
          <p className="muted">[{sect.tag}] · {rank.label} · Cấp {sect.level}</p>
        </div>
      </div>
      <blockquote>{sect.description}</blockquote>
      <div className="sect-metrics">
        <span>Tông chủ <b>{leader?.name ?? "Chưa rõ"}</b></span>
        <span>Thành viên <b>{sect.members.length}/{sect.memberLimit}</b></span>
        <span>Uy danh <b>{sect.reputation.toLocaleString("vi-VN")}</b></span>
        <span>Ngân khố <b>{Number(sect.treasury).toLocaleString("vi-VN")} Linh Thạch</b></span>
        <span>Tuyển thành viên <b>{sect.recruiting ? "Đang mở" : "Đóng"}</b></span>
      </div>
      <p className="muted">Yêu cầu gia nhập: {sect.joinRequirement}</p>

      <div className="sect-public-sections">
        <section>
          <h3><Users size={16} /> Thành viên tiêu biểu</h3>
          <div className="sect-public-member-list">
            {seniorMembers.length === 0 ? <p className="muted">Chưa có thành viên.</p> : seniorMembers.map((member: any) => (
              <article key={member.id} className="sect-public-member-row">
                <CharacterVisual character={member.character} mode="avatar" size={40} />
                <div>
                  <b>{member.character.name}</b>
                  <span>{roleLabel(member.role)}</span>
                  <small>{member.character.realmStage.realm.name} {member.character.realmStage.name}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h3><Building2 size={16} /> Công trình</h3>
          <div className="sect-public-chip-list">
            {sect.buildings.length === 0 ? <p className="muted">Chưa có công trình.</p> : sect.buildings.slice(0, 8).map((building: any) => (
              <span key={building.id}>{building.name} <b>Lv.{building.level}</b></span>
            ))}
          </div>
        </section>
        <section>
          <h3><ScrollText size={16} /> Nhiệm vụ đang mở</h3>
          <div className="sect-public-chip-list">
            {sect.missions.length === 0 ? <p className="muted">Chưa có nhiệm vụ đang mở.</p> : sect.missions.map((mission: any) => (
              <span key={mission.id}>{mission.title} <b>{"★".repeat(mission.difficulty)}</b></span>
            ))}
          </div>
        </section>
        <section>
          <h3><BookOpen size={16} /> Tàng Kinh Các</h3>
          <div className="sect-public-chip-list">
            {sect.libraryTechniques.length === 0 ? <p className="muted">Chưa mở công pháp.</p> : sect.libraryTechniques.map((entry: any) => (
              <span key={entry.id}>{entry.technique.name} <b>{entry.technique.rarity}</b></span>
            ))}
          </div>
        </section>
      </div>

      {alreadyApplied ? (
        <form action={cancelSectApplicationAction}>
          <input type="hidden" name="applicationId" value={sect.applications[0]?.id ?? pendingApplicationId} />
          <button className="btn btn-secondary" type="submit">Hủy đơn đang chờ</button>
        </form>
      ) : (
        sect.tag === "TVM" ? (
          <div className="sect-apply-form">
            <form action={revealThanhVanSpiritualRootAction}>
              <input type="hidden" name="back" value={`/game/sect?sect=${sect.id}`} />
              <button className="btn btn-secondary" type="submit">Giám định Linh Căn</button>
            </form>
            <form action={completeThanhVanAdmissionAction}>
              <input type="hidden" name="sectId" value={sect.id} />
              <button className="btn" type="submit">Nhận Ngoại Môn Lệnh</button>
            </form>
            <p className="muted">Thanh Vân Môn dùng chuỗi nhiệm vụ nhập môn riêng. Hoàn thành khảo hạch rồi quay lại nhận lệnh bài.</p>
          </div>
        ) : (
          <form action={applyToSectAction} className="sect-apply-form">
            <input type="hidden" name="sectId" value={sect.id} />
            <textarea name="message" className="field" placeholder="Lời nhắn xin nhập môn..." rows={3} />
            <button className="btn" type="submit" disabled={!sect.recruiting || sect.members.length >= sect.memberLimit}>Xin gia nhập</button>
          </form>
        )
      )}
    </div>
  );
}

function roleWeight(role: string) {
  return ({ LEADER: 0, VICE_LEADER: 1, ELDER: 2, OFFICER: 3, TRUE_DISCIPLE: 4, INNER: 5, OUTER: 6 } as Record<string, number>)[role] ?? 99;
}

function roleLabel(role: string) {
  return ({
    LEADER: "Tông Chủ",
    VICE_LEADER: "Phó Tông Chủ",
    ELDER: "Trưởng Lão",
    OFFICER: "Chấp Sự",
    TRUE_DISCIPLE: "Chân Truyền Đệ Tử",
    INNER: "Nội Môn Đệ Tử",
    OUTER: "Ngoại Môn Đệ Tử"
  } as Record<string, string>)[role] ?? "Thành viên";
}

function CreateSectPanel({ characterLinhThach }: { characterLinhThach: bigint }) {
  const canPay = characterLinhThach >= sectCreateCost;
  return (
    <section className="sect-create-grid">
      <form action={createSectAction} className="panel sect-create-form">
        <div>
          <p className="eyebrow">KHAI SƠN LẬP PHÁI</p>
          <h2>Dựng đạo thống Ngũ Phẩm</h2>
          <p className="muted">Chi phí khai sơn: <CurrencyAmount amount={sectCreateCost} />. Tông chủ nhận Tông Môn Đại Điện và Động Phủ Ngoại Môn cơ bản.</p>
        </div>
        <input className="field" name="name" placeholder="Tên tông môn" minLength={3} maxLength={48} required />
        <input className="field" name="tag" placeholder="Ký hiệu 2-6 ký tự" minLength={2} maxLength={6} required />
        <textarea className="field" name="description" placeholder="Tuyên ngôn / mô tả tông môn" rows={4} />
        <div className="sect-form-row">
          <p className="muted sect-create-note">Biểu tượng sơn môn sẽ được Tông Chủ chọn một lần sau khi khai sơn.</p>
          <select className="field" name="alignment" defaultValue={SectAlignment.NEUTRAL}>
            <option value={SectAlignment.RIGHTEOUS}>Chính đạo</option>
            <option value={SectAlignment.NEUTRAL}>Trung lập</option>
            <option value={SectAlignment.DEMONIC}>Ma đạo</option>
          </select>
        </div>
        <button className="btn" type="submit" disabled={!canPay}>Khai sơn lập phái - <CurrencyAmount amount={sectCreateCost} /></button>
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
