import { prisma, SectFacilityType, SectWorkStatus, type SectRoleName } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { acceptSectMissionAction, approveSectApplicationAction, claimSectMiningAction, completeSectMissionAction, depositSectCurrencyAction, depositSectItemAction, exchangeSectTechniqueAction, expandSectFacilityAction, harvestSectCropAction, plantSectCropAction, rejectSectApplicationAction, startSectCaveCultivationAction, startSectMiningAction, upgradeSectRankAction, withdrawSectCurrencyAction, withdrawSectItemAction } from "@/lib/forms";
import { ActionAlert } from "@/components/ActionAlert";
import { getItemEconomy, getNextSectRank, getSectCaveBenefit, getSectItemContributionPrice, getSectRank, hasSectPermission, refreshSectMissionPool, sectAlignments, sectFacilityConfig, sectFarmConfig, sectLibraryConfig, sectMineConfig, sectRankProgress, sectRoles } from "@ttg/game";
import { formatRarity } from "@/lib/format";
import { formatCurrency, ItemDetailPanel, ItemSummaryCard } from "@/components/ItemCard";
import { BookOpen, Boxes, Building2, Castle, Crown, Gem, Landmark, Leaf, Pickaxe, ScrollText, Shield, Sparkles, Users } from "lucide-react";

const tabs = [
  ["overview", "Tổng Quan"],
  ["members", "Thành Viên"],
  ["missions", "Nhiệm Vụ"],
  ["domain", "Sơn Môn"],
  ["caves", "Động Phủ"],
  ["library", "Tàng Kinh Các"],
  ["storage", "Kho Tông Môn"],
  ["mine", "Linh Khoáng"],
  ["farm", "Linh Điền"],
  ["admin", "Quản Trị"]
] as const;

export default async function SectHomePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string; error?: string; created?: string; ok?: string; storageItem?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!user) redirect("/");
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      sectMember: true,
      techniques: { select: { techniqueId: true } },
      items: { where: { quantity: { gt: 0 }, equippedSlot: null, bound: false }, include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true } } }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!character.sectId) redirect(`/game/sect?sect=${id}`);
  if (character.sectId !== id) redirect(`/game/sect/${character.sectId}`);

  await refreshSectMissionPool(prisma, id);
  const sect = await prisma.sect.findUniqueOrThrow({
    where: { id },
    include: {
      members: {
        include: { character: { include: { realmStage: { include: { realm: true } } } } },
        orderBy: [{ role: "asc" }, { contribution: "desc" }]
      },
      buildings: { orderBy: [{ level: "desc" }, { name: "asc" }] },
      announcements: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 5, include: { author: true } },
      applications: {
        where: { status: "PENDING" },
        include: { character: { include: { realmStage: { include: { realm: true } } } } },
        orderBy: { createdAt: "asc" }
      },
      logs: { orderBy: { createdAt: "desc" }, take: 12, include: { actor: true } },
      treasuryTransactions: { orderBy: { createdAt: "desc" }, take: 12, include: { character: true } },
      inventoryItems: { where: { quantity: { gt: 0 } }, include: { template: true }, orderBy: { updatedAt: "desc" } },
      inventoryLogs: { orderBy: { createdAt: "desc" }, take: 12, include: { character: true, template: true } },
      contributionTransactions: { orderBy: { createdAt: "desc" }, take: 8, include: { character: true } },
      missions: { where: { status: "ACTIVE" }, orderBy: [{ difficulty: "asc" }, { title: "asc" }], take: 12 },
      missionParticipants: { where: { characterId: character.id }, orderBy: { startedAt: "desc" }, take: 8 },
      facilityExpansions: true,
      farmPlots: { orderBy: { plotIndex: "asc" }, include: { planter: true } },
      mineWorks: { orderBy: { startedAt: "desc" }, take: 16, include: { worker: true } },
      caves: { orderBy: [{ quality: "desc" }, { name: "asc" }], include: { assignedCharacter: true } },
      libraryTechniques: { include: { technique: true }, orderBy: { createdAt: "desc" } }
    }
  });
  const selfMember = sect.members.find((member) => member.characterId === character.id);
  const canAdmin = hasSectPermission(selfMember?.role, "VIEW_ADMIN");
  const activeTab = tabs.some(([key]) => key === query?.tab) ? query!.tab! : "overview";
  if (activeTab === "admin" && !canAdmin) redirect(`/game/sect/${id}`);
  const rankState = sectRankProgress(sect.rank, sect.reputation);
  const leader = sect.members.find((member) => member.role === "LEADER")?.character;

  return (
    <div className="sect-page">
      <header className="sect-home-hero">
        <div className="sect-emblem hero"><Castle size={38} /></div>
        <div className="sect-home-title">
          <p className="eyebrow">{sectAlignments[sect.alignment]}</p>
          <h1>{sect.name}</h1>
          <p>{getSectRank(sect.rank).label} · [{sect.tag}]</p>
          <blockquote>{sect.description}</blockquote>
        </div>
        <div className="sect-home-stats">
          <span><Users size={16} /> {sect.members.length}/{sect.memberLimit} Thành viên</span>
          <span><Gem size={16} /> {sect.treasury.toLocaleString("vi-VN")} Linh Thạch</span>
          <span><Sparkles size={16} /> {sect.reputation.toLocaleString("vi-VN")} Uy Danh</span>
          <span><Crown size={16} /> {leader?.name ?? "Chưa rõ"}</span>
        </div>
      </header>

      <ActionAlert message={query?.error} />
      {query?.created ? <ActionAlert message="Khai sơn lập phái thành công. Bạn đã trở thành Tông Chủ." /> : null}
      {query?.ok ? <ActionAlert message="Sự vụ tông môn đã được xử lý thành công." /> : null}

      <section className="panel sect-rank-panel">
        <div>
          <p className="eyebrow">TIẾN ĐỘ THĂNG PHẨM</p>
          <h2>{rankState.current.shortLabel}{rankState.next ? ` → ${rankState.next.shortLabel}` : " · Đỉnh cấp hiện tại"}</h2>
        </div>
        <div className="sect-progress">
          <div style={{ width: `${rankState.progress}%` }} />
        </div>
        <p className="muted">{rankState.next ? `${sect.reputation.toLocaleString("vi-VN")} / ${rankState.required.toLocaleString("vi-VN")} Uy Danh` : "Đã đạt Nhất Phẩm. Những phẩm cấp đặc biệt sẽ mở về sau."}</p>
      </section>

      <nav className="sect-tabs sect-tabs-wrap" aria-label="Khu vực tông môn">
        {tabs.filter(([key]) => key !== "admin" || canAdmin).map(([key, label]) => (
          <a key={key} className={activeTab === key ? "active" : ""} href={`/game/sect/${id}?tab=${key}`}>{label}</a>
        ))}
      </nav>

      {activeTab === "members" ? <MembersTab sect={sect} canManage={hasSectPermission(selfMember?.role, "MANAGE_MEMBERS")} /> : null}
      {activeTab === "missions" ? <MissionsTab sect={sect} /> : null}
      {activeTab === "domain" ? <DomainTab sect={sect} canManage={hasSectPermission(selfMember?.role, "MANAGE_BUILDINGS")} canRankUp={hasSectPermission(selfMember?.role, "UPGRADE_SECT")} /> : null}
      {activeTab === "caves" ? <CavesTab sect={sect} role={selfMember?.role} /> : null}
      {activeTab === "library" ? <LibraryTab sect={sect} selfRole={selfMember?.role} contribution={selfMember?.contribution ?? 0} ownedTechniqueIds={character.techniques.map((item) => item.techniqueId)} /> : null}
      {activeTab === "storage" ? <StorageTab sect={sect} characterItems={character.items} selectedStorageId={query?.storageItem ?? ""} canManageTreasury={hasSectPermission(selfMember?.role, "MANAGE_TREASURY")} canManageStorage={hasSectPermission(selfMember?.role, "MANAGE_STORAGE")} /> : null}
      {activeTab === "mine" ? <MineTab sect={sect} characterId={character.id} /> : null}
      {activeTab === "farm" ? <FarmTab sect={sect} /> : null}
      {activeTab === "admin" && canAdmin ? <AdminTab sect={sect} /> : null}
      {activeTab === "overview" ? <OverviewTab sect={sect} selfRole={selfMember?.role} selfContribution={selfMember?.contribution ?? 0} /> : null}
    </div>
  );
}

function OverviewTab({ sect, selfRole, selfContribution }: { sect: any; selfRole?: SectRoleName | undefined; selfContribution: number }) {
  const next = getNextSectRank(sect.rank);
  return (
    <div className="sect-dashboard-grid">
      <section className="panel sect-board large">
        <h2>Sự vụ tông môn</h2>
        <div className="sect-affairs">
          <Affair icon={<Pickaxe size={20} />} title="Linh Khoáng" text={sect.rank <= 3 ? "3 người đang khai thác · 01:42:16" : "Mở từ Tam Phẩm"} />
          <Affair icon={<Leaf size={20} />} title="Linh Điền" text={sect.rank <= 4 ? "Thanh Linh Thảo · 04:12:53" : "Mở từ Tứ Phẩm"} />
          <Affair icon={<ScrollText size={20} />} title="Nhiệm Vụ" text="8 nhiệm vụ cơ bản đang mở" />
          <Affair icon={<Sparkles size={20} />} title="Thăng phẩm" text={next ? `Còn ${Math.max(0, getSectRank(sect.rank).reputationRequired - sect.reputation).toLocaleString("vi-VN")} Uy Danh` : "Đã đạt Nhất Phẩm"} />
        </div>
      </section>
      <section className="panel sect-board">
        <h2>Thông báo</h2>
        {sect.announcements.length === 0 ? <p className="muted">Chưa có thông báo tông môn.</p> : sect.announcements.map((item: any) => (
          <article key={item.id} className="sect-note">
            <b>{item.title}</b>
            <p>{item.body}</p>
            <small>{item.author?.name ?? "Tông môn"}</small>
          </article>
        ))}
      </section>
      <section className="panel sect-board">
        <h2>Thân phận của bạn</h2>
        <div className="sect-metrics vertical">
          <span>Chức vụ <b>{sectRoles[selfRole as keyof typeof sectRoles]?.label ?? "Đệ tử"}</b></span>
          <span>Cống hiến cá nhân <b>{selfContribution.toLocaleString("vi-VN")}</b></span>
          <span>Cống hiến tuần <b>0</b></span>
        </div>
      </section>
      <section className="panel sect-board large">
        <h2>Nhật ký tông môn</h2>
        <LogList logs={sect.logs} />
      </section>
    </div>
  );
}

function MembersTab({ sect, canManage }: { sect: any; canManage: boolean }) {
  return (
    <section className="panel sect-table-panel">
      <h2>Thành viên</h2>
      <div className="sect-member-list">
        {sect.members.map((member: any) => (
          <article key={member.id} className="sect-member-row">
            <div>
              <b>{member.character.name}</b>
              <span>{member.character.realmStage.realm.name} {member.character.realmStage.name}</span>
            </div>
            <span>{sectRoles[member.role as keyof typeof sectRoles].label}</span>
            <span>{member.contribution.toLocaleString("vi-VN")} cống hiến</span>
            <span>{new Intl.DateTimeFormat("vi-VN").format(member.joinedAt)}</span>
            {canManage ? <small>Quản trị chức vụ sẽ mở ở bước kế tiếp</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function MissionsTab({ sect }: { sect: any }) {
  return (
    <section className="sect-two-col">
      {sect.missions.map((mission: any) => {
        const active = sect.missionParticipants.find((entry: any) => entry.missionId === mission.id && (entry.status === "ACTIVE" || entry.status === "READY_TO_TURN_IN"));
        const completed = sect.missionParticipants.find((entry: any) => entry.missionId === mission.id && entry.status === "COMPLETED");
        const reward = mission.reward ?? {};
        const objective = mission.objective ?? {};
        return (
          <article key={mission.id} className="panel sect-feature-card">
            <div className="sect-feature-head">
              <ScrollText />
              <b>{mission.title}</b>
              <span>{"★".repeat(mission.difficulty)}</span>
            </div>
            <p>{mission.description}</p>
            <div className="sect-mission-meta">
              <span>Loại <b>{formatMissionType(mission.type)}</b></span>
              <span>Địa điểm <b>{objective.locationName ?? "Theo địa đồ"}</b></span>
              <span>Mục tiêu <b>{formatMissionObjective(mission, objective)}</b></span>
              <span>Tiến độ <b>{active ? `${active.progress}/${active.targetCount}` : completed ? `${completed.targetCount}/${completed.targetCount}` : `0/${mission.targetCount}`}</b></span>
            </div>
            <p className="muted">Thưởng: +{reward.cultivation ?? 0} Tu Vi · +{reward.linhThach ?? 0} Linh Thạch · +{reward.contribution ?? 0} Cống Hiến · +{reward.reputation ?? 0} Uy Danh</p>
            {active?.status === "READY_TO_TURN_IN" ? (
              <form action={completeSectMissionAction}>
                <input type="hidden" name="sectId" value={sect.id} />
                <input type="hidden" name="participantId" value={active.id} />
                <button className="btn" type="submit">Nộp nhiệm vụ</button>
              </form>
            ) : active ? (
              <a className="btn btn-secondary" href={mission.locationId ? `/game/world?location=${objective.locationKey ?? ""}` : "/game/world"}>Đi tới khu vực</a>
            ) : (
              <form action={acceptSectMissionAction}>
                <input type="hidden" name="sectId" value={sect.id} />
                <input type="hidden" name="missionKey" value={mission.id} />
                <button className="btn btn-secondary" type="submit">{completed ? "Nhận lại nhiệm vụ" : "Nhận nhiệm vụ"}</button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}

function formatMissionType(type: string) {
  return ({
    HUNT: "Săn Yêu",
    COLLECT: "Thu Thập",
    EXPLORE: "Thám Hiểm",
    DELIVER: "Giao Vật",
    PATROL: "Tuần Tra",
    MINE: "Khai Khoáng",
    FARM: "Linh Điền",
    DONATE: "Cống Hiến"
  } as Record<string, string>)[type] ?? "Nhiệm vụ";
}

function formatMissionObjective(mission: any, objective: Record<string, unknown>) {
  if (mission.type === "HUNT") return `${objective.monsterKey ?? "Yêu thú"} ${mission.targetCount}`;
  if (mission.type === "COLLECT") return `${objective.itemKey ?? "Tài nguyên"} ${mission.targetCount}`;
  if (mission.type === "EXPLORE" || mission.type === "PATROL") return objective.locationName ? `Tới ${objective.locationName}` : "Khảo sát địa điểm";
  return `${mission.targetCount} mục tiêu`;
}

function facilityOf(sect: any, facilityType: SectFacilityType) {
  const currentRank = getSectRank(sect.rank);
  const key = facilityType === SectFacilityType.FARM ? "farm" : facilityType === SectFacilityType.CAVE ? "cave" : facilityType === SectFacilityType.MINE ? "mine" : "storage";
  return sect.facilityExpansions.find((item: any) => item.facilityType === facilityType) ?? { facilityType, currentCapacity: sectFacilityConfig.defaults[facilityType], maxCapacity: currentRank.capacities[key], expansionCount: 0 };
}

function DomainTab({ sect, canManage, canRankUp }: { sect: any; canManage: boolean; canRankUp: boolean }) {
  const rank = getSectRank(sect.rank);
  const next = getNextSectRank(sect.rank);
  const cards = [
    { type: null, href: `/game/sect/${sect.id}`, icon: <Castle />, title: "Tông Môn Đại Điện", meta: rank.shortLabel, body: "Trung tâm quản trị, thành viên, thông báo và uy danh." },
    { type: null, href: `/game/sect/${sect.id}?tab=missions`, icon: <ScrollText />, title: "Nhiệm Vụ Đường", meta: `${sect.missions.length} nhiệm vụ`, body: "Đệ tử nhận việc, tạo cống hiến và tăng Uy Danh." },
    { type: SectFacilityType.STORAGE, href: `/game/sect/${sect.id}?tab=storage`, icon: <Boxes />, title: "Kho Tông Môn", meta: `${sect.inventoryItems.length} loại vật phẩm`, body: "Tài nguyên chung dùng cho thăng phẩm, mở rộng và crafting sau này." },
    { type: SectFacilityType.FARM, href: `/game/sect/${sect.id}?tab=farm`, icon: <Leaf />, title: "Linh Điền", meta: `${sect.farmPlots.length}/${facilityOf(sect, SectFacilityType.FARM).maxCapacity} ô`, body: "Trồng linh thảo, chia sản lượng cho người trồng và kho tông môn." },
    { type: SectFacilityType.MINE, href: `/game/sect/${sect.id}?tab=mine`, icon: <Pickaxe />, title: "Linh Khoáng", meta: `${facilityOf(sect, SectFacilityType.MINE).currentCapacity}/${facilityOf(sect, SectFacilityType.MINE).maxCapacity} mạch`, body: "Khai thác khoáng vật, tạo dòng tài nguyên cho tông môn." },
    { type: SectFacilityType.CAVE, href: `/game/sect/${sect.id}?tab=caves`, icon: <Landmark />, title: "Động Phủ", meta: `${sect.caves.length}/${facilityOf(sect, SectFacilityType.CAVE).maxCapacity} động`, body: "Phân phối nơi bế quan, tăng hiệu suất tu luyện theo backend." },
    { type: null, href: `/game/sect/${sect.id}?tab=library`, icon: <BookOpen />, title: "Tàng Kinh Các", meta: `${sect.libraryTechniques.length} công pháp`, body: sect.rank <= 4 ? "Dùng cống hiến để lĩnh ngộ công pháp đã mở." : "Mở từ Tứ Phẩm." },
    { type: null, href: "#", icon: <Shield />, title: "Hộ Sơn Đại Trận", meta: sect.rank <= 2 ? "Đã mở" : "Yêu cầu Nhị Phẩm", body: "Trận pháp phòng ngự, sect war và buff sẽ nối ở phase sau." },
    { type: null, href: "#", icon: <Sparkles />, title: "Bí Cảnh Tông Môn", meta: sect.rank <= 1 ? "Đã mở" : "Yêu cầu Nhất Phẩm", body: "Nội dung endgame, chỉ hiển thị trạng thái mở khóa ở Phase 3." }
  ];
  return (
    <section className="sect-dashboard-grid">
      <div className="panel sect-board large">
        <h2>Sơn Môn</h2>
        <p className="muted">Phẩm cấp quyết định giới hạn, khu vực mở và chất lượng tài nguyên. Không nâng từng công trình theo level.</p>
        <div className="sect-domain-grid">
          {cards.map((card) => {
            const facility = card.type ? facilityOf(sect, card.type) : null;
            const locked = card.title === "Tàng Kinh Các" && sect.rank > 4 || card.title === "Hộ Sơn Đại Trận" && sect.rank > 2 || card.title === "Bí Cảnh Tông Môn" && sect.rank > 1;
            return (
              <article key={card.title} className={`sect-domain-card ${locked ? "locked" : ""}`}>
                <div className="sect-feature-head">{card.icon}<b>{card.title}</b><span>{card.meta}</span></div>
                <p>{card.body}</p>
                <div className="sect-domain-actions">
                  {!locked && card.href !== "#" ? <a className="btn btn-secondary" href={card.href}>Đi tới</a> : <button className="btn btn-secondary" disabled>Đang khóa</button>}
                  {facility && canManage && facility.currentCapacity < facility.maxCapacity ? (
                    <form action={expandSectFacilityAction}>
                      <input type="hidden" name="sectId" value={sect.id} />
                      <input type="hidden" name="facilityType" value={card.type ?? ""} />
                      <button className="btn" type="submit">Mở rộng</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="panel sect-board">
        <h2>Thăng phẩm</h2>
        {next ? (
          <>
            <p>{rank.shortLabel} → {next.shortLabel}</p>
            <p className="muted">Yêu cầu: {rank.reputationRequired.toLocaleString("vi-VN")} Uy Danh, {rank.rankUpCost?.treasury.toLocaleString("vi-VN")} Linh Thạch, {rank.rankUpCost?.memberCount} thành viên.</p>
            <p className="muted">Tài nguyên: {rank.rankUpCost?.resources.map((item) => `${item.quantity} ${item.key}`).join(", ")}</p>
            {canRankUp ? (
              <form action={upgradeSectRankAction}>
                <input type="hidden" name="sectId" value={sect.id} />
                <button className="btn" type="submit">Thăng phẩm</button>
              </form>
            ) : <p className="muted">Bạn không có quyền thăng phẩm.</p>}
          </>
        ) : <p className="muted">Đã đạt Nhất Phẩm.</p>}
      </div>
    </section>
  );
}

function StorageTab({ sect, characterItems, selectedStorageId, canManageTreasury, canManageStorage }: { sect: any; characterItems: any[]; selectedStorageId: string; canManageTreasury: boolean; canManageStorage: boolean }) {
  const selectedStorage = sect.inventoryItems.find((item: any) => item.id === selectedStorageId) ?? null;
  return (
    <section className="sect-dashboard-grid">
      <div className="panel sect-board">
        <h2>Quỹ Tông Môn</h2>
        <div className="sect-metrics vertical">
          <span>Linh Thạch <b>{sect.treasury.toLocaleString("vi-VN")}</b></span>
          <span>Loại vật phẩm <b>{sect.inventoryItems.length}</b></span>
          <span>Quyền rút quỹ <b>{canManageTreasury ? "Có" : "Không"}</b></span>
        </div>
        <form action={depositSectCurrencyAction} className="sect-inline-form">
          <input type="hidden" name="sectId" value={sect.id} />
          <input className="field" name="amount" placeholder="Cống hiến Linh Thạch" inputMode="numeric" />
          <button className="btn" type="submit">Cống hiến</button>
        </form>
        {canManageTreasury ? (
          <form action={withdrawSectCurrencyAction} className="sect-inline-form">
            <input type="hidden" name="sectId" value={sect.id} />
            <input className="field" name="amount" placeholder="Rút Linh Thạch" inputMode="numeric" />
            <button className="btn btn-secondary" type="submit">Rút quỹ</button>
          </form>
        ) : null}
      </div>

      <div className="panel sect-board">
        <h2>Cống hiến vật phẩm</h2>
        {characterItems.length === 0 ? <p className="muted">Túi đồ không có vật phẩm có thể cống hiến.</p> : (
          <form action={depositSectItemAction} className="sect-inline-form">
            <input type="hidden" name="sectId" value={sect.id} />
            <select className="field" name="itemId">
              {characterItems.filter((item) => item.listings.length === 0).map((item) => {
                const economy = getItemEconomy(item.template);
                return <option key={item.id} value={item.id}>{item.template.name} · {formatRarity(item.template.rarity)} Phẩm · x{item.quantity} · +{economy.donationContributionValue}/cái</option>;
              })}
            </select>
            <input className="field" name="quantity" defaultValue="1" inputMode="numeric" />
            <button className="btn" type="submit">Gửi kho</button>
          </form>
        )}
      </div>

      <div className="panel sect-board large">
        <h2>Cửa hàng cống hiến</h2>
        {selectedStorage ? (
          <div className="item-storage-detail mt-4">
            <ItemDetailPanel
              template={selectedStorage.template}
              quantityLabel={`Kho còn ${selectedStorage.quantity.toLocaleString("vi-VN")}`}
              source="Kho Tông Môn"
              condition={canManageStorage ? "Có quyền quản lý kho" : "Cần đủ cống hiến cá nhân để đổi"}
              action={<SectWithdrawItemForm sectId={sect.id} item={selectedStorage} canManageStorage={canManageStorage} />}
            />
          </div>
        ) : null}
        <div className="market-card-grid mt-4">
          {sect.inventoryItems.length === 0 ? <p className="muted">Kho tông môn chưa có vật phẩm.</p> : sect.inventoryItems.map((item: any) => {
            return (
              <ItemSummaryCard
                key={item.id}
                template={item.template}
                quantityLabel={`x${item.quantity.toLocaleString("vi-VN")}`}
                priceLabel={`${formatCurrency(getSectItemContributionPrice(item.template))} Cống Hiến`}
                href={`/game/sect/${sect.id}?tab=storage&storageItem=${item.id}`}
                selected={selectedStorage?.id === item.id}
                action={<SectWithdrawItemForm sectId={sect.id} item={item} canManageStorage={canManageStorage} />}
              />
          );})}
        </div>
      </div>

      <div className="panel sect-board large">
        <h2>Lịch sử kinh tế</h2>
        <LogList logs={[
          ...sect.treasuryTransactions.map((tx: any) => ({ ...tx, message: `${tx.character?.name ?? "Tông môn"} ${tx.reason}: ${tx.amount.toLocaleString("vi-VN")} ${tx.currency}` })),
          ...sect.inventoryLogs.map((log: any) => ({ ...log, message: `${log.character?.name ?? "Tông môn"} ${log.reason}: ${log.template.name} x${Math.abs(log.quantity)}` })),
          ...sect.contributionTransactions.map((tx: any) => ({ ...tx, message: `${tx.character?.name ?? "Đệ tử"} ${tx.reason}: ${tx.amount > 0 ? "+" : ""}${tx.amount} cống hiến` }))
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 16)} />
      </div>
    </section>
  );
}

function SectWithdrawItemForm({ sectId, item, canManageStorage }: { sectId: string; item: any; canManageStorage: boolean }) {
  return (
    <form action={withdrawSectItemAction} className="item-card-action">
      <input type="hidden" name="sectId" value={sectId} />
      <input type="hidden" name="storageId" value={item.id} />
      <input className="field item-qty-field" name="quantity" defaultValue="1" inputMode="numeric" min="1" max={item.quantity} aria-label="Số lượng" />
      <button className="btn btn-secondary" type="submit">{canManageStorage ? "Rút" : "Đổi"}</button>
    </form>
  );
}

function FarmTab({ sect }: { sect: any }) {
  const crops = Object.entries(sectFarmConfig.crops);
  return (
    <section className="sect-dashboard-grid">
      <div className="panel sect-board large">
        <h2>Linh Điền Tông Môn</h2>
        <p className="muted">Sản lượng do backend tính. Chia cơ bản: 70% người trồng, 30% Kho Tông Môn.</p>
        <div className="sect-domain-grid compact">
          {sect.farmPlots.map((plot: any) => {
            const crop = plot.cropKey ? sectFarmConfig.crops[plot.cropKey as keyof typeof sectFarmConfig.crops] : null;
            const ready = plot.status === SectWorkStatus.ACTIVE && plot.readyAt && plot.readyAt <= new Date();
            return (
              <article key={plot.id} className="sect-domain-card">
                <div className="sect-feature-head"><Leaf /><b>Ô {String(plot.plotIndex).padStart(2, "0")}</b><span>{plot.status}</span></div>
                {crop ? <p>{crop.name} · Người trồng: {plot.planter?.name ?? "Không rõ"} · Sẵn sàng: {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(plot.readyAt)}</p> : <p>Ô đất trống, có thể gieo linh thảo.</p>}
                <p className="muted">Dự kiến: {crop ? `${Math.floor(crop.baseYield * 0.7)} cá nhân / ${Math.ceil(crop.baseYield * 0.3)} tông môn` : "Chọn giống để bắt đầu chu kỳ."}</p>
                {!crop || plot.status === SectWorkStatus.CLAIMED ? (
                  <form action={plantSectCropAction} className="sect-inline-form">
                    <input type="hidden" name="sectId" value={sect.id} />
                    <input type="hidden" name="plotId" value={plot.id} />
                    <select className="field" name="cropKey">
                      {crops.filter(([, entry]) => sect.rank <= entry.requiredRank).map(([key, entry]) => <option key={key} value={key}>{entry.name} · {entry.durationMinutes} phút</option>)}
                    </select>
                    <button className="btn" type="submit">Trồng</button>
                  </form>
                ) : (
                  <form action={harvestSectCropAction}>
                    <input type="hidden" name="sectId" value={sect.id} />
                    <input type="hidden" name="plotId" value={plot.id} />
                    <button className="btn" type="submit" disabled={!ready}>Thu hoạch</button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MineTab({ sect, characterId }: { sect: any; characterId: string }) {
  const mines = Object.entries(sectMineConfig.mines).filter(([, mine]) => sect.rank <= mine.requiredRank);
  const activeWorks = sect.mineWorks.filter((work: any) => work.status === SectWorkStatus.ACTIVE);
  return (
    <section className="sect-dashboard-grid">
      <div className="panel sect-board large">
        <h2>Linh Khoáng</h2>
        <p className="muted">Chia cơ bản: 40% người khai thác, 60% Kho Tông Môn. Rare drop do backend roll theo lượt khai thác.</p>
        <div className="sect-domain-grid compact">
          {mines.length === 0 ? <p className="muted">Linh Khoáng chưa mở ở phẩm cấp hiện tại.</p> : mines.map(([key, mine]) => (
            <article key={key} className="sect-domain-card">
              <div className="sect-feature-head"><Pickaxe /><b>{mine.name}</b><span>{activeWorks.filter((work: any) => work.mineKey === key).length}/{mine.workerLimit}</span></div>
              <p>Tài nguyên: {mine.resourceKey} · Chu kỳ: {mine.durationMinutes} phút · Sản lượng nền: {mine.baseYield}</p>
              <p className="muted">Rare: {mine.rareDrops.length ? mine.rareDrops.map((drop) => `${drop.chanceBps / 100}% ${drop.key}`).join(", ") : "Không có"}</p>
              <form action={startSectMiningAction}>
                <input type="hidden" name="sectId" value={sect.id} />
                <input type="hidden" name="mineKey" value={key} />
                <button className="btn" type="submit">Khai thác</button>
              </form>
            </article>
          ))}
        </div>
      </div>
      <div className="panel sect-board">
        <h2>Lượt khai thác</h2>
        <div className="sect-storage-list">
          {sect.mineWorks.filter((work: any) => work.workerId === characterId).length === 0 ? <p className="muted">Bạn chưa có lượt khai thác.</p> : sect.mineWorks.filter((work: any) => work.workerId === characterId).map((work: any) => {
            const mine = sectMineConfig.mines[work.mineKey as keyof typeof sectMineConfig.mines];
            const ready = work.status === SectWorkStatus.ACTIVE && work.readyAt <= new Date();
            return (
              <article key={work.id} className="sect-storage-row">
                <div><b>{mine?.name ?? work.mineKey}</b><span>{work.status} · {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(work.readyAt)}</span></div>
                <form action={claimSectMiningAction}>
                  <input type="hidden" name="sectId" value={sect.id} />
                  <input type="hidden" name="workId" value={work.id} />
                  <button className="btn btn-secondary" type="submit" disabled={!ready}>Nhận</button>
                </form>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CavesTab({ sect, role }: { sect: any; role?: SectRoleName | undefined }) {
  const effectiveRole = role ?? "OUTER";
  const cave = getSectCaveBenefit(effectiveRole, sect.rank);
  return (
    <section className="sect-dashboard-grid">
      <div className="panel sect-board large">
        <h2>Động Phủ của bạn</h2>
        <article className="sect-domain-card">
          <div className="sect-feature-head"><Landmark /><b>{cave.name}</b><span>{getSectRank(sect.rank).shortLabel}</span></div>
          <p>Thân phận: {sectRoles[effectiveRole].label}</p>
          <p>Linh khí +{Math.round(cave.cultivationBonusBps / 100)}% · Đột phá +{Math.round(cave.breakthroughBonusBps / 100)}%</p>
          <p className="muted">Bonus tự đổi theo chức vụ và phẩm cấp tông môn. Không cần Tông Chủ phân phối thủ công.</p>
          <form action={startSectCaveCultivationAction} className="sect-inline-form">
            <input type="hidden" name="sectId" value={sect.id} />
            <input type="hidden" name="caveId" value="auto" />
            <select className="field" name="minutes"><option value="1">1 phút</option><option value="3">3 phút</option><option value="5">5 phút</option><option value="10">10 phút</option></select>
            <button className="btn" type="submit">Bế quan tu luyện</button>
          </form>
        </article>
      </div>
    </section>
  );
}

function LibraryTab({ sect, selfRole, contribution, ownedTechniqueIds }: { sect: any; selfRole?: SectRoleName | undefined; contribution: number; ownedTechniqueIds: string[] }) {
  return (
    <section className="sect-dashboard-grid">
      <div className="panel sect-board large">
        <h2>Tàng Kinh Các</h2>
        <p className="muted">Công pháp dùng hệ Technique hiện tại. Lĩnh ngộ sẽ trừ cống hiến atomically và tạo CharacterTechnique.</p>
        <div className="sect-domain-grid compact">
          {sect.libraryTechniques.length === 0 ? <p className="muted">Chưa mở công pháp. Thăng phẩm Tứ Phẩm trở lên sẽ tự mở kho sách theo config.</p> : sect.libraryTechniques.map((entry: any) => {
            const roleOk = selfRole ? sectRoles[selfRole].order <= sectRoles[entry.accessRole as SectRoleName].order : false;
            const owned = ownedTechniqueIds.includes(entry.techniqueId);
            return (
              <article key={entry.id} className="sect-domain-card">
                <div className="sect-feature-head"><BookOpen /><b>{entry.technique.name}</b><span>{entry.technique.rarity}</span></div>
                <p>{entry.technique.type} · hiệu suất tu luyện {Math.round(entry.technique.cultivationModifierBps / 100)}%</p>
                <p className="muted">Yêu cầu: {sectRoles[entry.accessRole as SectRoleName].label} · Giá {entry.contributionCost.toLocaleString("vi-VN")} cống hiến · Bạn có {contribution.toLocaleString("vi-VN")}</p>
                <form action={exchangeSectTechniqueAction}>
                  <input type="hidden" name="sectId" value={sect.id} />
                  <input type="hidden" name="libraryId" value={entry.id} />
                  <button className="btn" type="submit" disabled={!roleOk || owned || contribution < entry.contributionCost}>{owned ? "Đã sở hữu" : "Lĩnh ngộ"}</button>
                </form>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AdminTab({ sect }: { sect: any }) {
  return (
    <section className="sect-admin-grid">
      <div className="panel sect-board">
        <h2>Đơn xin gia nhập</h2>
        {sect.applications.length === 0 ? <p className="muted">Không có đơn chờ duyệt.</p> : sect.applications.map((application: any) => (
          <article key={application.id} className="sect-application-row">
            <div>
              <b>{application.character.name}</b>
              <span>{application.character.realmStage.realm.name} {application.character.realmStage.name}</span>
              <p>{application.message || "Không để lại lời nhắn."}</p>
            </div>
            <form action={approveSectApplicationAction}>
              <input type="hidden" name="sectId" value={sect.id} />
              <input type="hidden" name="applicationId" value={application.id} />
              <button className="btn" type="submit">Chấp nhận</button>
            </form>
            <form action={rejectSectApplicationAction}>
              <input type="hidden" name="sectId" value={sect.id} />
              <input type="hidden" name="applicationId" value={application.id} />
              <button className="btn btn-secondary" type="submit">Từ chối</button>
            </form>
          </article>
        ))}
      </div>
      <div className="panel sect-board">
        <h2>Quản trị sơn môn</h2>
        <div className="sect-metrics vertical">
          <span>Tuyển thành viên <b>{sect.recruiting ? "Đang mở" : "Đóng"}</b></span>
          <span>Tự động duyệt <b>{sect.autoAccept ? "Bật" : "Tắt"}</b></span>
          <span>Yêu cầu <b>{sect.joinRequirement}</b></span>
        </div>
        <p className="muted">Đổi thông tin, phân quyền, nâng phẩm và giải tán sẽ nối backend ở bước sau.</p>
      </div>
    </section>
  );
}

function Affair({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="sect-affair">{icon}<div><b>{title}</b><span>{text}</span></div></div>;
}

function FeatureCard({ icon, title, badge, body, cta, disabled }: { icon: React.ReactNode; title: string; badge: string; body: string; cta: string; disabled?: boolean }) {
  return (
    <article className="panel sect-feature-card">
      <div className="sect-feature-head">{icon}<b>{title}</b><span>{badge}</span></div>
      <p>{body}</p>
      <button className="btn btn-secondary" disabled={disabled}>{cta}</button>
    </article>
  );
}

function BuildingCard({ name, level, open, requiredRank }: { name: string; level: number; open: boolean; requiredRank?: string }) {
  return (
    <article className={`panel sect-building-card ${open ? "" : "locked"}`}>
      <Building2 size={22} />
      <h2>{name}</h2>
      <p>{open ? `Lv.${Math.max(1, level)} / Lv.3` : `Yêu cầu ${requiredRank}`}</p>
      <small>{open ? "Có thể nâng cấp bằng quỹ và tài nguyên tông môn." : "Chưa mở theo phẩm cấp hiện tại."}</small>
    </article>
  );
}

function LogList({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <p className="muted">Chưa có lịch sử hoạt động.</p>;
  return (
    <div className="sect-log-list">
      {logs.map((log) => (
        <div key={log.id} className="sect-log-row">
          <time>{new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(log.createdAt)}</time>
          <span>{log.message}</span>
        </div>
      ))}
    </div>
  );
}
