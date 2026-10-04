import { prisma, QuestStatus, SectAlignment } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { applyToSectAction, cancelSectApplicationAction, completeThanhVanAdmissionAction, createSectAction, revealThanhVanSpiritualRootAction } from "@/lib/forms";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { GamePageBackground } from "@/components/GamePageBackground";
import { getSectRank, progressQuestEvent, sectAlignments, sectCreateCost } from "@ttg/game";
import { SectEmblem } from "@/components/SectEmblem";
import { BadgeCheck, BookOpen, Building2, Crown, Eye, Hammer, Landmark, Lock, Medal, PackageOpen, ScrollText, Search, Shield, ShieldCheck, Sparkles, Swords, UserPlus, Users } from "lucide-react";

const rankFilters = ["5", "4", "3", "2", "1"] as const;

export default async function SectLobbyPage({ searchParams }: { searchParams?: Promise<{ tab?: string; q?: string; filter?: string; rank?: string; sect?: string; error?: string; applied?: string; ok?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      spiritualRoot: true,
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
  const publicSectSelect = {
    id: true,
    name: true,
    tag: true,
    description: true,
    iconKey: true,
    alignment: true,
    rank: true,
    level: true,
    reputation: true,
    memberLimit: true,
    recruiting: true,
    joinRequirement: true,
    members: {
      where: { role: "LEADER" as const },
      select: { character: { select: { id: true, name: true } } },
      take: 1
    },
    applications: { where: { characterId: character.id, status: "PENDING" as const }, select: { id: true } },
    _count: { select: { members: true } }
  };
  const sects = await prisma.sect.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { tag: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(filter === "recruiting" ? { recruiting: true } : {}),
      ...(rank ? { rank } : {}),
      ...(alignment ? { alignment } : {})
    },
    select: publicSectSelect,
    orderBy: [{ reputation: "desc" }, { createdAt: "asc" }],
    take: 24
  });
  const selected = params?.sect ? sects.find((sect) => sect.id === params.sect) ?? await prisma.sect.findUnique({ where: { id: params.sect }, select: publicSectSelect }) : sects[0] ?? null;
  const [thanhVanFlags, entryExam] = await Promise.all([
    prisma.characterQuestFlag.findMany({
      where: { characterId: character.id, key: { in: ["thanh_van_spiritual_root_revealed", "joined_thanh_van_outer"] } },
      select: { key: true }
    }),
    prisma.characterQuest.findFirst({
      where: { characterId: character.id, template: { key: "nhap-thanh-van-4" }, status: QuestStatus.COMPLETED },
      select: { id: true }
    })
  ]);
  const thanhVanFlagSet = new Set(thanhVanFlags.map((flag) => flag.key));
  const thanhVanStatus = {
    spiritualRootRevealed: thanhVanFlagSet.has("thanh_van_spiritual_root_revealed"),
    entryExamCompleted: Boolean(entryExam),
    spiritualRoot: character.spiritualRoot
  };
  const okMessage = sectLobbyOkMessage(params?.ok);

  return (
    <GamePageBackground type="sect">
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
      {okMessage ? <ActionAlert message={okMessage} /> : null}
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
            {selected ? <PublicSectProfile sect={selected} pendingApplicationId={character.sectApplications[0]?.id} thanhVanStatus={thanhVanStatus} /> : <p className="muted">Chọn một tông môn để xem sơn môn, tông chủ và điều kiện gia nhập.</p>}
          </section>
        </div>
      )}
    </div>
    </GamePageBackground>
  );
}

function sectLobbyOkMessage(ok?: string) {
  if (ok === "spiritual-root") return "Đã giám định Linh Căn. Kết quả đã được ghi vào đạo tịch nhập môn.";
  if (ok === "admission") return "Đã nhận Ngoại Môn Lệnh.";
  return null;
}

function SectListCard({ sect, active }: { sect: any; active: boolean }) {
  const rank = getSectRank(sect.rank);
  const leader = sect.members[0]?.character;
  const memberCount = sect._count?.members ?? 0;
  return (
    <a className={`sect-list-card ${active ? "active" : ""}`} href={`/game/sect?sect=${sect.id}`}>
      <SectEmblem iconKey={sect.iconKey} size="md" />
      <div>
        <h2>{sect.name}</h2>
        <p className="muted">[{sect.tag}] · {rank.label} · Cấp {sect.level}</p>
        <p>{sect.description}</p>
      </div>
      <div className="sect-list-meta">
        <span><Users size={15} /> {memberCount}/{sect.memberLimit}</span>
        <span><Crown size={15} /> {leader?.name ?? "Chưa rõ"}</span>
        <span><Sparkles size={15} /> {sect.reputation.toLocaleString("vi-VN")} Uy Danh</span>
        <span><Shield size={15} /> {sect.recruiting ? "Đang tuyển" : "Đóng tuyển"}</span>
      </div>
    </a>
  );
}

function PublicSectProfile({
  sect,
  pendingApplicationId,
  thanhVanStatus
}: {
  sect: any;
  pendingApplicationId?: string | undefined;
  thanhVanStatus: {
    spiritualRootRevealed: boolean;
    entryExamCompleted: boolean;
    spiritualRoot: { name: string; quality: string; multiplierBps: number; elements: string[] };
  };
}) {
  const rank = getSectRank(sect.rank);
  const leader = sect.members[0]?.character;
  const memberCount = sect._count?.members ?? 0;
  const alreadyApplied = sect.applications.length > 0 || Boolean(pendingApplicationId);
  const highlights = publicSectHighlights(sect);
  const isThanhVan = sect.tag === "TVM";
  const rootElements = thanhVanStatus.spiritualRoot.elements.length ? thanhVanStatus.spiritualRoot.elements.join(", ") : "không rõ hệ";
  const rootSpeed = `${Math.round(thanhVanStatus.spiritualRoot.multiplierBps / 100)}%`;
  return (
    <div className="sect-public-profile">
      <div className="sect-profile-head">
        <SectEmblem iconKey={sect.iconKey} size="lg" />
        <div>
          <h2>{sect.name}</h2>
          <p className="sect-profile-rankline"><Sparkles size={14} /> {rank.label} <span>·</span> Lv.{sect.level}</p>
        </div>
      </div>
      <blockquote>{sect.description}</blockquote>
      <div className="sect-metrics">
        <SectInfoMetric icon={Crown} label="Tông chủ" value={leader?.name ?? "Chưa rõ"} />
        <SectInfoMetric icon={Users} label="Thành viên" value={`${memberCount}/${sect.memberLimit}`} />
        <SectInfoMetric icon={Medal} label="Uy danh" value={sect.reputation.toLocaleString("vi-VN")} />
        <SectInfoMetric icon={UserPlus} label="Tuyển thành viên" value={sect.recruiting ? "Đang mở" : "Đóng"} />
      </div>
      <div className="sect-requirement-note">
        <ScrollText size={16} />
        <div>
          <span>Yêu cầu gia nhập</span>
          <b>{sect.joinRequirement}</b>
        </div>
      </div>

      <div className="sect-public-sections">
        <section>
          <h3><Sparkles size={16} /> Điểm nổi bật</h3>
          <div className="sect-public-chip-list">
            {highlights.map((highlight) => (
              <SectHighlightChip key={highlight} label={highlight} />
            ))}
          </div>
        </section>
        <section className="sect-internal-panel">
          <h3><Lock size={16} /> Nội dung nội bộ</h3>
          <p className="muted">Thành viên, nhiệm vụ, công trình, kho và Tàng Kinh Các chỉ mở sau khi chính thức gia nhập.</p>
          <div className="sect-unlock-list">
            <span><Users size={14} /> Thành viên</span>
            <span><ScrollText size={14} /> Nhiệm vụ</span>
            <span><Landmark size={14} /> Công trình</span>
            <span><PackageOpen size={14} /> Kho</span>
            <span><BookOpen size={14} /> Tàng Kinh Các</span>
          </div>
        </section>
      </div>

      {alreadyApplied ? (
        <form action={cancelSectApplicationAction}>
          <input type="hidden" name="applicationId" value={sect.applications[0]?.id ?? pendingApplicationId} />
          <button className="btn btn-secondary" type="submit">Hủy đơn đang chờ</button>
        </form>
      ) : (
        isThanhVan ? (
          <div className="sect-apply-form">
            <form action={revealThanhVanSpiritualRootAction}>
              <input type="hidden" name="back" value={`/game/sect?sect=${sect.id}`} />
              <button className="btn btn-secondary" type="submit" disabled={thanhVanStatus.spiritualRootRevealed}><Eye size={16} /> Giám định Linh Căn</button>
            </form>
            {thanhVanStatus.spiritualRootRevealed ? (
              <p className="muted">Linh Căn: {thanhVanStatus.spiritualRoot.name} · {thanhVanStatus.spiritualRoot.quality} · {rootElements} · tốc độ tu luyện {rootSpeed}.</p>
            ) : (
              <p className="muted">Dùng để mở kết quả Linh Căn đã có sẵn của nhân vật và ghi nhận bước Giám Linh Đài trong chuỗi nhập môn.</p>
            )}
            <form action={completeThanhVanAdmissionAction}>
              <input type="hidden" name="sectId" value={sect.id} />
              <button className="btn" type="submit" disabled={!thanhVanStatus.entryExamCompleted}>{thanhVanStatus.entryExamCompleted ? <BadgeCheck size={16} /> : <Lock size={16} />} Nhận Ngoại Môn Lệnh</button>
            </form>
            <p className="muted">
              {thanhVanStatus.entryExamCompleted
                ? "Bạn đã hoàn thành khảo hạch nhập môn, có thể nhận lệnh bài để trở thành Ngoại Môn Đệ Tử."
                : "Cần hoàn thành nhiệm vụ Nhập Thanh Vân: Khảo Hạch trước khi nhận Ngoại Môn Lệnh."}
            </p>
          </div>
        ) : (
          <form action={applyToSectAction} className="sect-apply-form">
            <input type="hidden" name="sectId" value={sect.id} />
            <textarea name="message" className="field" placeholder="Lời nhắn xin nhập môn..." rows={3} />
            <button className="btn" type="submit" disabled={!sect.recruiting || memberCount >= sect.memberLimit}>Xin gia nhập</button>
          </form>
        )
      )}
    </div>
  );
}

function SectInfoMetric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <span className="sect-info-metric">
      <Icon size={17} />
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function SectHighlightChip({ label }: { label: string }) {
  const Icon = highlightIcon(label);
  return (
    <span>
      <Icon size={15} />
      <b>{label}</b>
    </span>
  );
}

function highlightIcon(label: string) {
  if (label.includes("Kiếm")) return Swords;
  if (label.includes("Luyện")) return Hammer;
  if (label.includes("Trận")) return ShieldCheck;
  if (label.includes("Truyền")) return ScrollText;
  if (label.includes("Nội dung")) return Lock;
  if (label.includes("đạo thống")) return Landmark;
  if (label.includes("Phẩm")) return Sparkles;
  return Building2;
}

function publicSectHighlights(sect: { tag: string; rank: number; alignment: SectAlignment }) {
  if (sect.tag === "TVM") return ["Kiếm đạo", "Luyện khí", "Trận pháp", "Truyền thừa lâu đời"];
  const rank = getSectRank(sect.rank);
  return [rank.shortLabel, "Có đạo thống riêng", "Nội dung mở theo thân phận"];
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
