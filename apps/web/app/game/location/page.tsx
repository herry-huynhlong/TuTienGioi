import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { attackEncounterAction, breakSealItemAction, cancelExploreAction, escapeEncounterItemAction, exploreAction, interactWorldObjectAction, leaveEncounterAction, startTravelAction, useCombatItemAction } from "@/lib/forms";
import { formatLocationKind, formatSecurity, formatService } from "@/lib/game-display";
import { advanceExplorationActivity, currentEnergy, getItemEconomy, getItemUsageDefinition, getNpcsAtLocation, getWorldInteractionsForLocation, locationActivityConfigs, recordOnboardingEvent, travelDurationSeconds } from "@ttg/game";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionAlert } from "@/components/ActionAlert";
import { ActivityCountdown } from "@/components/ActivityCountdown";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { GamePageBackground } from "@/components/GamePageBackground";
import { ItemSummaryCard } from "@/components/ItemCard";
import { Compass, Home, Landmark, Mail, MessageCircle, Route, ScrollText, Shield, ShoppingBag, Swords, Trees, UserRound } from "lucide-react";

const activityLabels: Record<string, string> = {
  market: "Vạn Bảo Lâu",
  auction: "Đấu giá",
  npc_shop: "Quầy giao dịch",
  inn: "Khách điếm",
  mail: "Thư tín",
  travel: "Dịch trạm",
  caravan: "Tiêu cục",
  explore: "Khám phá",
  pve: "Săn yêu",
  resource: "Thu thập",
  encounter: "Điều tra",
  formation: "Trận pháp",
  secret: "Bí cảnh",
  forging: "Luyện khí"
};

type LocationActivityMode = "explore" | "hunt" | "gather";

const activityCopy: Record<LocationActivityMode, { title: string; cta: string; description: string; icon: React.ReactNode }> = {
  explore: { title: "Khám phá", cta: "Khám phá", description: "Tìm kiếm lối đi, dấu vết và những nơi chưa được biết đến.", icon: <Compass size={18} aria-hidden /> },
  hunt: { title: "Săn bắn", cta: "Đi săn", description: "Theo dấu dã thú và yêu thú trong khu vực.", icon: <Swords size={18} aria-hidden /> },
  gather: { title: "Thu thập", cta: "Thu thập", description: "Tìm kiếm dược liệu và tài nguyên tự nhiên.", icon: <Trees size={18} aria-hidden /> }
};

export default async function LocationPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      explorations: { where: { status: { in: ["ACTIVE", "COMPLETED", "CLAIMED"] } }, orderBy: [{ status: "asc" }, { endsAt: "desc" }], take: 6 },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      travels: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      currentLocation: { include: { zone: { include: { region: true } }, routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } } } },
      location: true,
      items: { where: { quantity: { gt: 0 }, equippedSlot: null, listings: { none: { status: "ACTIVE" } } }, include: { template: true }, orderBy: { createdAt: "desc" } },
      quests: { where: { status: { in: ["ACTIVE", "READY_TO_TURN_IN", "COMPLETED"] } }, include: { template: true } }
    }
  });
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");
  const dueActivity = c.explorations.find((activity) => activity.status === "ACTIVE" && activity.endsAt.getTime() <= Date.now());
  if (dueActivity) {
    await advanceExplorationActivity(prisma, c.id, dueActivity.id);
    redirect("/game/location");
  }
  const location = c.currentLocation;
  const services = location?.services ?? [];
  const activeExploration = c.explorations.find((activity) => activity.status === "ACTIVE");
  const pendingEncounter = c.explorations.find((activity) => activity.status === "COMPLETED");
  const latestResolved = c.explorations.find((activity) => activity.status === "CLAIMED");
  const hasBlockingActivity = Boolean(activeExploration || pendingEncounter || c.cultivationJobs.length || c.travels.length);
  const blockLabel = getBlockLabel(activeExploration, Boolean(pendingEncounter), c.cultivationJobs.length > 0, c.travels.length > 0);
  const energy = currentEnergy(c);
  const activities = getLocationActivities(services);
  const facilities = getLocationFacilities(services, location?.kind);
  const routes = location?.routesFrom ?? [];
  const [logs, itemTemplates, monsters, npcsAtLocation, worldSeals, interactions] = await Promise.all([
    prisma.gameLog.findMany({
    where: { characterId: c.id, type: { in: ["exploration", "encounter"] } },
    take: 6,
    orderBy: { createdAt: "desc" }
    }),
    prisma.itemTemplate.findMany(),
    prisma.monster.findMany({ select: { key: true, name: true, hp: true, realmOrder: true } }),
    location ? getNpcsAtLocation(prisma, c.id, location.id) : [],
    location ? prisma.worldSeal.findMany({ where: { locationId: location.id, status: "SEALED" }, orderBy: { createdAt: "asc" } }) : [],
    location ? getWorldInteractionsForLocation(prisma, c.id, location.id) : []
  ]);
  const itemTemplatesByKey = new Map(itemTemplates.map((item) => [item.key, item]));
  const monsterByKey = new Map(monsters.map((monster) => [monster.key, monster]));
  const usableItems = c.items.map((item) => ({ item, usage: getItemUsageDefinition(item.template) }));
  const combatItems = usableItems.filter(({ usage }) => usage.combatUsable && usage.effects.some((effect) => effect.type === "DEAL_DAMAGE" || effect.type === "APPLY_SHIELD" || effect.type === "APPLY_DEBUFF" || effect.type === "BUFF_STAT" || effect.type === "ESCAPE"));
  const breakSealItems = usableItems.filter(({ usage }) => usage.effects.some((effect) => effect.type === "BREAK_SEAL"));

  return (
    <GamePageBackground type="adventure">
    <div className="p-5 lg:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Địa điểm</p>
          <h1 className="mt-1 text-3xl font-black">{location?.name ?? c.location?.name ?? "Vô định"}</h1>
          <p className="muted mt-2">{location?.zone.region?.name ?? "Chưa rõ địa vực"} · {location?.zone.name ?? "Chưa rõ khu vực"}</p>
        </div>
        <Link href="/game/world" className="btn btn-secondary">Xem Thế Giới</Link>
      </header>
      <ActionAlert message={params?.error} />

      <section className="location-hero">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Địa điểm hiện tại</p>
          <h2>{location?.name ?? "Chưa rõ"}</h2>
          <p className="muted mt-2">{location?.description ?? "Chưa có mô tả địa điểm."}</p>
        </div>
        <div className="location-meta">
          <span><b>Loại</b>{location ? formatLocationKind(location.kind) : "Không rõ"}</span>
          <span><b>An ninh</b>{location ? formatSecurity(location.securityLevel) : "Không rõ"}</span>
          <span><b>Hoạt động</b>{activities.length ? activities.map((activity) => activityCopy[activity].title).join(", ") : "Không có hoạt động"}</span>
          <span><b>Cơ sở</b>{facilities.length ? facilities.map((facility) => facility.label).join(", ") : "Chưa mở"}</span>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="grid gap-5">
          {facilities.length > 0 ? (
            <Panel title="Cơ sở tại đây">
              <div className="action-grid">
                {facilities.map((facility) => <FacilityCard key={facility.key} facility={facility} />)}
              </div>
            </Panel>
          ) : null}

          {npcsAtLocation.length ? (
            <Panel title="Nhân vật">
              <div className="npc-grid">
                {npcsAtLocation.map((npc) => <NpcCard key={npc.id} npc={npc} quests={c.quests} />)}
              </div>
            </Panel>
          ) : null}

          {worldSeals.length > 0 ? (
            <Panel title="Phong ấn / Cấm chế">
              <div className="action-grid">
                {worldSeals.map((seal) => <WorldSealCard key={seal.id} seal={seal} items={breakSealItems} />)}
              </div>
            </Panel>
          ) : null}

          {interactions.length > 0 ? (
            <Panel title="Có thể tương tác">
              <div className="action-grid">
                {interactions.map((node) => <WorldInteractionCard key={node.key} node={node} />)}
              </div>
            </Panel>
          ) : null}

          {routes.length > 0 ? (
            <Panel title="Tuyến đường">
              <div className="route-grid">
                {routes.map((route) => (
                  <form key={route.id} action={startTravelAction} className="route-card">
                    <input type="hidden" name="routeId" value={route.id} />
                    <div className="route-card-main">
                      <b><Route size={16} aria-hidden />{route.destination.name}</b>
                      <small>{formatLocationKind(route.destination.kind)}</small>
                    </div>
                    <div className="route-card-meta">
                      <span><b>Thời gian</b>{formatTravelDuration(route.travelMinutes)}</span>
                      <span><b>Chi phí</b>{route.travelCost > 0n ? <CurrencyAmount amount={route.travelCost} /> : "Miễn phí"}</span>
                      <span><b>Nguy hiểm</b>{formatDanger(route.dangerLevel)}</span>
                    </div>
                    {hasBlockingActivity ? <p className="route-disabled-note">Hoàn thành hoặc dừng hoạt động hiện tại để di chuyển.</p> : null}
                    <button className="btn btn-secondary" disabled={hasBlockingActivity}>{hasBlockingActivity ? "Không thể di chuyển" : "Đi tới"}</button>
                  </form>
                ))}
              </div>
            </Panel>
          ) : null}

          {activities.length > 0 ? (
            <Panel title="Hoạt động tại đây">
            <div className="action-grid">
              {activities.map((mode) => (
                <ExploreForm key={mode} mode={mode} disabled={hasBlockingActivity || energy < locationActivityConfigs[mode].energyCost} reason={hasBlockingActivity ? blockLabel : energy < locationActivityConfigs[mode].energyCost ? "Thiếu thể lực" : activityCopy[mode].cta} />
              ))}
            </div>
            </Panel>
          ) : null}

          {facilities.length === 0 && routes.length === 0 && activities.length === 0 ? (
            <Panel title="Không có hành động trực tiếp">
              <div className="empty-state">
                <b>Địa điểm này không có hành động trực tiếp.</b>
                <p>Hãy mở Thế Giới để di chuyển tới nơi có cơ sở hoặc hoạt động phù hợp.</p>
                <Link href="/game/world" className="btn mt-4">Chọn địa điểm khác</Link>
              </div>
            </Panel>
          ) : null}
        </div>

        <Panel title="Tình huống hiện tại">
          <SituationPanel active={activeExploration} pending={pendingEncounter} latest={latestResolved} logs={logs} combatItems={combatItems} itemTemplatesByKey={itemTemplatesByKey} monsterByKey={monsterByKey} />
        </Panel>
      </section>
    </div>
    </GamePageBackground>
  );
}

function NpcCard({
  npc,
  quests
}: {
  npc: { key: string; name: string; title: string; description: string; portraitUrl: string | null; avatarUrl?: string | null; iconKey: string; questStarts: Array<{ id: string }>; questTurnIns: Array<{ id: string }> };
  quests: Array<{ status: string; templateId: string; template: { startNpcId: string | null; turnInNpcId: string | null } }>;
}) {
  const npcImage = npc.avatarUrl ?? npc.portraitUrl;
  const ready = quests.some((quest) => quest.status === "READY_TO_TURN_IN" && npc.questTurnIns.some((template) => template.id === quest.templateId));
  const active = quests.some((quest) => quest.status === "ACTIVE" && (npc.questStarts.some((template) => template.id === quest.templateId) || npc.questTurnIns.some((template) => template.id === quest.templateId)));
  const completed = new Set(quests.filter((quest) => quest.status === "COMPLETED").map((quest) => quest.templateId));
  const hasNew = npc.questStarts.some((template) => !completed.has(template.id) && !quests.some((quest) => quest.templateId === template.id));
  const badge = ready ? "?" : hasNew ? "!" : active ? "..." : "";
  return (
    <article className="npc-card">
      <div className="npc-portrait">
        {npcImage ? <img src={npcImage} alt="" /> : <UserRound size={30} aria-hidden />}
        {badge ? <span className={`npc-badge npc-badge-${ready ? "ready" : hasNew ? "new" : "active"}`}>{badge}</span> : null}
      </div>
      <div>
        <b>{npc.name}</b>
        <small>{npc.title}</small>
        <p>{npc.description}</p>
        <Link href={`/game/npc/${npc.key}`} className="btn btn-secondary mt-3 w-full"><MessageCircle size={16} aria-hidden /> Trò chuyện</Link>
      </div>
    </article>
  );
}

function getLocationActivities(services: string[]): LocationActivityMode[] {
  const modes: LocationActivityMode[] = [];
  if (services.includes("explore")) modes.push("explore");
  if (services.includes("pve")) modes.push("hunt");
  if (services.includes("resource")) modes.push("gather");
  return modes;
}

function getLocationFacilities(services: string[], kind?: string) {
  const facilities: Array<{ key: string; label: string; description: string; href?: string; disabled?: boolean; icon: React.ReactNode }> = [];
  if (services.includes("market")) facilities.push({ key: "market", label: "Vạn Bảo Lâu", description: "Mua bán vật phẩm, thu mua chiến lợi phẩm và bày hàng cho người chơi.", href: "/game/market", icon: <ShoppingBag size={18} aria-hidden /> });
  if (services.includes("mail")) facilities.push({ key: "mail", label: "Thư tín", description: "Đọc thư và thông báo cá nhân.", href: "/game/mail", icon: <Mail size={18} aria-hidden /> });
  if (services.includes("inn")) facilities.push({ key: "inn", label: "Khách điếm", description: "Nghỉ chân, hồi phục và nghe tin tức trong thành.", disabled: true, icon: <Home size={18} aria-hidden /> });
  if (services.includes("auction")) facilities.push({ key: "auction", label: "Đấu giá", description: "Nơi các kỳ vật được đưa lên sàn tranh giá theo lượt.", href: "/game/auction", icon: <Landmark size={18} aria-hidden /> });
  if (services.includes("caravan")) facilities.push({ key: "caravan", label: "Tiêu cục", description: "Nhận hộ tống hàng hóa qua các tuyến nguy hiểm.", disabled: true, icon: <Route size={18} aria-hidden /> });
  if (services.includes("formation")) facilities.push({ key: "formation", label: "Trận pháp", description: "Bố trí trận bàn, phù văn và các phép bảo hộ.", disabled: true, icon: <Shield size={18} aria-hidden /> });
  if (kind === "sect_land") facilities.push({ key: "sect", label: "Tông môn", description: "Xem sơn môn, đệ tử và sự vụ trong tông.", href: "/game/sect", icon: <ScrollText size={18} aria-hidden /> });
  return facilities;
}

function FacilityCard({ facility }: { facility: { label: string; description: string; href?: string; disabled?: boolean; icon: React.ReactNode } }) {
  const body = (
    <>
      <div className="facility-card-title">{facility.icon}<b>{facility.label}</b></div>
      <p className="muted text-sm">{facility.description}</p>
      {facility.href && !facility.disabled ? <span className="btn btn-secondary w-full">Vào</span> : <button className="btn btn-secondary w-full" disabled>Sắp mở</button>}
    </>
  );
  return facility.href && !facility.disabled ? <Link href={facility.href} className="action-card">{body}</Link> : <div className="action-card">{body}</div>;
}

function WorldInteractionCard({ node }: { node: { key: string; name: string; description: string; actionLabel: string; missionParticipant: { status: string; title: string; progress: number; targetCount: number } | null } }) {
  const usable = node.missionParticipant?.status === "ACTIVE";
  return (
    <form action={interactWorldObjectAction} className="action-card">
      <input type="hidden" name="objectKey" value={node.key} />
      <input type="hidden" name="actionKey" value={`${node.key}:${node.missionParticipant?.progress ?? 0}`} />
      <div className="facility-card-title"><Shield size={18} aria-hidden /><b>{node.name}</b></div>
      <p className="muted text-sm">{node.description}</p>
      {node.missionParticipant ? <p className="muted text-sm">Nhiệm vụ: {node.missionParticipant.title} · {node.missionParticipant.progress}/{node.missionParticipant.targetCount}</p> : <p className="muted text-sm">Chưa có nhiệm vụ yêu cầu thao tác này.</p>}
      <button className="btn btn-secondary w-full" type="submit" disabled={!usable}>{usable ? node.actionLabel : "Chưa thể kiểm tra"}</button>
    </form>
  );
}

function ExploreForm({ mode, disabled, reason }: { mode: LocationActivityMode; disabled: boolean; reason: string }) {
  const config = activityCopy[mode];
  const runtime = locationActivityConfigs[mode];
  return (
    <form action={exploreAction} className="action-card">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="durationSeconds" value={runtime.durationSeconds} />
      <div>
        <span className="facility-card-title">{config.icon}<b>{config.title}</b></span>
        <small>{runtime.durationSeconds} giây · tốn {runtime.energyCost} thể lực</small>
      </div>
      <p className="muted text-sm">{config.description}</p>
      <button className="btn btn-secondary w-full" disabled={disabled}>{reason}</button>
    </form>
  );
}

function SituationPanel({
  active,
  pending,
  latest,
  logs,
  combatItems,
  itemTemplatesByKey,
  monsterByKey
}: {
  active: { id: string; startedAt: Date; endsAt: Date; reward: unknown } | undefined;
  pending: { id: string; reward: unknown } | undefined;
  latest: { id: string; eventKey: string | null; reward: unknown; claimedAt: Date | null } | undefined;
  logs: Array<{ id: string; message: string; createdAt: Date }>;
  combatItems: Array<{ item: { id: string; quantity: number; template: ItemTemplateReward }; usage: ReturnType<typeof getItemUsageDefinition> }>;
  itemTemplatesByKey: Map<string, ItemTemplateReward>;
  monsterByKey: Map<string, { key: string; name: string; hp: number; realmOrder: number }>;
}) {
  if (active) {
    const mode = activityModeFromReward(active.reward);
    const reward = parseReward(active.reward);
    const session = parseReward(reward.session);
    return (
      <div className="situation-card">
        <p className="text-xs font-bold uppercase text-jade">{mode === "hunt" ? "Đang săn bắn" : `Đang ${activityCopy[mode].title.toLowerCase()}`}</p>
        <h3>{activityCopy[mode].title}</h3>
        <p className="muted">{activityNarrative(mode, session)}</p>
        {mode === "hunt" ? <p className="mt-3 text-sm text-gold">Tiến độ chuyến săn: {huntProgress(session)}%</p> : null}
        <ActivityCountdown startedAt={active.startedAt.toISOString()} endsAt={active.endsAt.toISOString()} />
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={cancelExploreAction}>
            <input type="hidden" name="id" value={active.id} />
            <button className="btn btn-secondary">{mode === "hunt" ? "Hủy chuyến săn" : "Hủy hoạt động"}</button>
          </form>
        </div>
      </div>
    );
  }

  if (pending) {
    const reward = parseReward(pending.reward);
    const monster = typeof reward.monster === "string" ? monsterByKey.get(reward.monster) : null;
    const combatState = parseReward(reward.combatState);
    const monsterHp = typeof combatState.monsterHp === "number" && monster ? Math.max(0, combatState.monsterHp) : monster?.hp;
    const stateLog = Array.isArray(combatState.log) ? combatState.log.filter((entry): entry is string => typeof entry === "string") : [];
    return (
      <div className="situation-card">
        <p className="text-xs font-bold uppercase text-jade">Phát hiện</p>
        <h3>{monster?.name ?? "Dấu vết yêu thú"}</h3>
        <p className="muted mt-2">Bạn nghe tiếng lá khô chuyển động gần đó. Một sinh vật đang quan sát bạn từ phía xa.</p>
        <div className="info-table mt-4">
          <div><span>Cảnh giới</span><b>Bậc {monster?.realmOrder ?? "?"}</b></div>
          <div><span>HP</span><b>{monster ? `${monsterHp}/${monster.hp}` : "Chưa rõ"}</b></div>
          <div><span>Nguy hiểm</span><b>Thấp</b></div>
        </div>
        <CombatItemPanel activityId={pending.id} monsterKey={monster?.key ?? ""} combatItems={combatItems} />
        {stateLog.length > 0 ? (
          <div className="event-list mt-4">
            {stateLog.slice(-4).map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
          </div>
        ) : null}
        <p className="muted mt-3">Bạn muốn làm gì?</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={attackEncounterAction}>
            <input type="hidden" name="id" value={pending.id} />
            <button className="btn">Tấn công</button>
          </form>
          <form action={leaveEncounterAction}>
            <input type="hidden" name="id" value={pending.id} />
            <button className="btn btn-secondary">Bỏ qua</button>
          </form>
        </div>
      </div>
    );
  }

  if (latest) {
    const reward = parseReward(latest.reward);
    const combat = parseReward(reward.combat);
    const combatReward = parseReward(combat.reward);
    const loot = parseReward(combatReward.loot);
    const lootItems = Array.isArray(loot.items) ? loot.items : [];
    const rewardTemplate = typeof reward.item === "string" ? itemTemplatesByKey.get(reward.item) : null;
    const itemName = typeof reward.item === "string" ? rewardTemplate?.name ?? reward.item : null;
    const mode = activityModeFromReward(latest.reward);
    return (
      <div className="situation-card">
        <p className="text-xs font-bold uppercase text-jade">Kết quả gần nhất</p>
        <h3>{activityCopy[mode].title} hoàn thành</h3>
        {rewardTemplate ? (
          <div className="reward-item-grid mt-3">
            <RewardItemCard template={rewardTemplate} quantity={typeof reward.quantity === "number" ? reward.quantity : 1} source={activityCopy[mode].title} />
          </div>
        ) : itemName ? <p className="mt-2"><b className="text-gold">{itemName}</b> x{typeof reward.quantity === "number" ? reward.quantity : 1}</p> : null}
        {combat.winner ? <p className="mt-2">{combat.winner === "player" ? "Bạn đã đánh bại yêu thú." : "Bạn rút khỏi trận chiến sau khi bị thương."}</p> : null}
        {typeof loot.linhThach === "string" && loot.linhThach !== "0" ? <p className="mt-2 text-gold">+<CurrencyAmount amount={loot.linhThach} /></p> : null}
        {lootItems.length > 0 ? (
          <div className="reward-item-grid mt-3">
            {lootItems.map((entry, index) => {
              const row = parseReward(entry);
              const key = typeof row.key === "string" ? row.key : "";
              const template = key ? itemTemplatesByKey.get(key) : null;
              return template ? (
                <RewardItemCard key={`${key}-${index}`} template={template} quantity={quantityFromReward(row.quantity)} source="Chiến lợi phẩm" />
              ) : (
                <span key={index} className="reward-fallback-item">{String(row.name ?? row.key ?? "Chiến lợi phẩm")} <b>x{String(row.quantity ?? 1)}</b></span>
              );
            })}
          </div>
        ) : null}
        {!itemName && !combat.winner ? <p className="muted mt-2">Tình huống đã được xử lý.</p> : null}
      </div>
    );
  }

  return (
    <div>
      <div className="event-list">
        {logs.map((log) => <p key={log.id}><b>{log.createdAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</b><br />{log.message}</p>)}
        {logs.length === 0 ? <p className="muted">Chưa có ghi chép tại địa điểm này.</p> : null}
      </div>
    </div>
  );
}

function CombatItemPanel({ activityId, monsterKey, combatItems }: { activityId: string; monsterKey: string; combatItems: Array<{ item: { id: string; quantity: number; template: ItemTemplateReward }; usage: ReturnType<typeof getItemUsageDefinition> }> }) {
  if (combatItems.length === 0) return <p className="muted mt-4 text-sm">Không có phù chiến đấu có thể dùng.</p>;
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase text-jade">Vật phẩm</p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {combatItems.map(({ item, usage }) => {
          const targetId = usage.targetType === "ENEMY" ? monsterKey : "";
          const effect = usage.effects[0];
          const action = effect?.type === "ESCAPE" ? escapeEncounterItemAction : useCombatItemAction;
          return (
            <form key={item.id} action={action} className="activity-row activity-row-stacked">
              <input type="hidden" name="id" value={activityId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="targetId" value={targetId} />
              <input type="hidden" name="actionKey" value={`${activityId}:${item.id}:${item.quantity}`} />
              <span>
                <b>{item.template.name} x{item.quantity}</b>
                <small>{combatEffectText(effect)}</small>
              </span>
              <button className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Dùng</button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

function combatEffectText(effect: { type: string; payload: Record<string, unknown> } | undefined) {
  if (!effect) return "Dùng trong chiến đấu.";
  if (effect.type === "DEAL_DAMAGE") return `Gây sát thương ${effect.payload.element === "FIRE" ? "Hỏa" : "Lôi"} lên một mục tiêu.`;
  if (effect.type === "APPLY_SHIELD") return "Tạo Hộ Thuẫn cho bản thân.";
  if (effect.type === "APPLY_DEBUFF") return "Giảm Thân Pháp mục tiêu.";
  if (effect.type === "BUFF_STAT") return "Tăng chỉ số trong trận.";
  if (effect.type === "ESCAPE") return "Rút khỏi biến cố thường.";
  return "Dùng trong chiến đấu.";
}

function WorldSealCard({ seal, items }: { seal: { id: string; name: string; description: string; requiredBreakSealGrade: number }; items: Array<{ item: { id: string; quantity: number; template: ItemTemplateReward }; usage: ReturnType<typeof getItemUsageDefinition> }> }) {
  const usable = items.find(({ usage }) => usage.effects.some((effect) => effect.type === "BREAK_SEAL" && typeof effect.payload.grade === "number" && effect.payload.grade >= seal.requiredBreakSealGrade));
  return (
    <article className="facility-card">
      <div>
        <b>{seal.name}</b>
        <p>{seal.description}</p>
        <small>Cấp phong ấn {seal.requiredBreakSealGrade} · cần Phá Cấm Phù cấp {seal.requiredBreakSealGrade}+</small>
      </div>
      {usable ? (
        <form action={breakSealItemAction} className="mt-3">
          <input type="hidden" name="sealId" value={seal.id} />
          <input type="hidden" name="itemId" value={usable.item.id} />
          <input type="hidden" name="actionKey" value={`${seal.id}:${usable.item.id}:${usable.item.quantity}`} />
          <button className="btn btn-secondary w-full">Dùng {usable.item.template.name}</button>
        </form>
      ) : (
        <button className="btn btn-secondary mt-3 w-full" disabled>Thiếu Phá Cấm Phù phù hợp</button>
      )}
    </article>
  );
}

type ItemTemplateReward = {
  key?: string;
  name: string;
  category: string;
  rarity: string;
  description: string;
  equipSlot?: string | null;
  tradeable: boolean;
  itemFamily?: string | null;
  baseModifiers: unknown;
  bindRules: unknown;
};

function RewardItemCard({ template, quantity, source }: { template: ItemTemplateReward; quantity: number; source: string }) {
  const economy = getItemEconomy(template);
  return (
    <ItemSummaryCard
      template={template}
      quantityLabel={`x${quantity}`}
      priceLabel={<CurrencyAmount amount={economy.systemBasePrice} />}
      sellerLabel={source}
    />
  );
}

function quantityFromReward(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.floor(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return Math.max(1, Number(value));
  return 1;
}

function parseReward(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function activityModeFromReward(value: unknown): LocationActivityMode {
  const mode = parseReward(value).mode;
  return mode === "hunt" || mode === "gather" || mode === "explore" ? mode : "explore";
}

function busyLabel(activity: { reward: unknown }) {
  return `Đang ${activityCopy[activityModeFromReward(activity.reward)].title.toLowerCase()}`;
}

function getBlockLabel(activeExploration: { reward: unknown } | undefined, pendingEncounter: boolean, cultivating: boolean, traveling: boolean) {
  if (activeExploration) return busyLabel(activeExploration);
  if (pendingEncounter) return "Đang xử lý tình huống";
  if (cultivating) return "Đang bế quan";
  if (traveling) return "Đang di chuyển";
  return "Đang bận";
}

function activityNarrative(mode: LocationActivityMode, session: Record<string, unknown>) {
  if (mode === "hunt") {
    const log = Array.isArray(session.log) ? session.log.filter((entry) => typeof entry === "string") : [];
    return log.at(-1) ?? "Bạn đang lần theo dấu vết trong khu vực.";
  }
  if (mode === "explore") return "Bạn đang men theo những lối mòn sâu hơn trong khu vực.";
  return "Bạn đang tìm kiếm dược liệu và tài nguyên tự nhiên.";
}

function huntProgress(session: Record<string, unknown>) {
  const duration = typeof session.durationSeconds === "number" ? session.durationSeconds * 1000 : 60_000;
  const elapsed = typeof session.activeElapsedMs === "number" ? session.activeElapsedMs : 0;
  return Math.max(0, Math.min(100, Math.round((elapsed / Math.max(1, duration)) * 100)));
}

function formatDanger(value: number) {
  if (value <= 1) return "An toàn";
  if (value <= 3) return "Thấp";
  if (value <= 6) return "Trung bình";
  return "Cao";
}

function formatTravelDuration(travelMinutes: number) {
  return `${travelDurationSeconds(travelMinutes)} giây`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
