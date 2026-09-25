import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { attackEncounterAction, cancelExploreAction, claimExploreAction, exploreAction, leaveEncounterAction, startTravelAction } from "@/lib/forms";
import { formatLocationKind, formatSecurity, formatService } from "@/lib/format";
import { currentEnergy, locationActivityConfigs, recordOnboardingEvent, travelDurationSeconds } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { ActivityCountdown } from "@/components/ActivityCountdown";
import { Compass, Home, Landmark, Mail, Route, ScrollText, Shield, ShoppingBag, Swords, Trees } from "lucide-react";

const activityLabels: Record<string, string> = {
  market: "Chợ",
  auction: "Đấu giá",
  npc_shop: "Cửa hàng NPC",
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
  explore: { title: "Khám phá", cta: "Khám phá", description: "Tìm lối mòn, dấu vết, khu vực ẩn hoặc cơ duyên phù hợp địa hình.", icon: <Compass size={18} aria-hidden /> },
  hunt: { title: "Săn bắn", cta: "Đi săn", description: "Theo dấu sinh vật trong khu vực. Kết quả chỉ phát hiện mục tiêu, không tự động chiến đấu.", icon: <Swords size={18} aria-hidden /> },
  gather: { title: "Thu thập", cta: "Thu thập", description: "Tìm dược liệu, linh mộc, khoáng thạch hoặc tài nguyên tự nhiên của khu vực.", icon: <Trees size={18} aria-hidden /> }
};

export default async function LocationPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      explorations: { where: { status: { in: ["ACTIVE", "COMPLETED", "CLAIMED"] } }, orderBy: [{ status: "asc" }, { endsAt: "desc" }], take: 6 },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      travels: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      currentLocation: { include: { zone: { include: { region: true } }, routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } } } },
      location: true
    }
  });
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");
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
  const [logs, itemTemplates, monsters] = await Promise.all([
    prisma.gameLog.findMany({
    where: { characterId: c.id, type: { in: ["exploration", "encounter"] } },
    take: 6,
    orderBy: { createdAt: "desc" }
    }),
    prisma.itemTemplate.findMany({ select: { key: true, name: true } }),
    prisma.monster.findMany({ select: { key: true, name: true, hp: true, realmOrder: true } })
  ]);
  const itemNames = new Map(itemTemplates.map((item) => [item.key, item.name]));
  const monsterByKey = new Map(monsters.map((monster) => [monster.key, monster]));

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Location</p>
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
          <span><b>Hoạt động</b>{activities.length ? activities.map((activity) => activityCopy[activity].title).join(", ") : "Không có wilderness loop"}</span>
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

          {routes.length > 0 ? (
            <Panel title="Tuyến đường">
              <div className="route-grid">
                {routes.map((route) => (
                  <form key={route.id} action={startTravelAction} className="route-card">
                      <input type="hidden" name="routeId" value={route.id} />
                    <div>
                      <b>{route.destination.name}</b>
                      <small>{formatTravelDuration(route.travelMinutes)} · {route.travelCost.toString()} linh thạch · nguy hiểm {route.dangerLevel}</small>
                    </div>
                  <button className="btn btn-secondary" disabled={hasBlockingActivity}>{hasBlockingActivity ? blockLabel : "Đi tới"}</button>
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
          <SituationPanel active={activeExploration} pending={pendingEncounter} latest={latestResolved} logs={logs} itemNames={itemNames} monsterByKey={monsterByKey} />
        </Panel>
      </section>
    </div>
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
  if (services.includes("market")) facilities.push({ key: "market", label: "Chợ", description: "Mua bán vật phẩm giữa người chơi.", href: "/game/market", icon: <ShoppingBag size={18} aria-hidden /> });
  if (services.includes("mail")) facilities.push({ key: "mail", label: "Thư tín", description: "Đọc thư và thông báo cá nhân.", href: "/game/mail", icon: <Mail size={18} aria-hidden /> });
  if (services.includes("inn")) facilities.push({ key: "inn", label: "Khách điếm", description: "Nghỉ chân, hồi phục và nghe tin tức trong thành.", disabled: true, icon: <Home size={18} aria-hidden /> });
  if (services.includes("auction")) facilities.push({ key: "auction", label: "Đấu giá", description: "Nơi các kỳ vật được đưa lên sàn tranh giá.", disabled: true, icon: <Landmark size={18} aria-hidden /> });
  if (services.includes("caravan")) facilities.push({ key: "caravan", label: "Tiêu cục", description: "Nhận hộ tống hàng hóa qua các tuyến nguy hiểm.", disabled: true, icon: <Route size={18} aria-hidden /> });
  if (services.includes("formation")) facilities.push({ key: "formation", label: "Trận pháp", description: "Bố trí trận bàn, phù văn và các phép bảo hộ.", disabled: true, icon: <Shield size={18} aria-hidden /> });
  if (kind === "sect_land") facilities.push({ key: "sect", label: "Tông môn", description: "Xem hoặc lập tông môn bằng hệ thống hiện có.", href: "/game/sect", icon: <ScrollText size={18} aria-hidden /> });
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
  itemNames,
  monsterByKey
}: {
  active: { id: string; startedAt: Date; endsAt: Date; reward: unknown } | undefined;
  pending: { id: string; reward: unknown } | undefined;
  latest: { id: string; eventKey: string | null; reward: unknown; claimedAt: Date | null } | undefined;
  logs: Array<{ id: string; message: string; createdAt: Date }>;
  itemNames: Map<string, string>;
  monsterByKey: Map<string, { key: string; name: string; hp: number; realmOrder: number }>;
}) {
  if (active) {
    const mode = activityModeFromReward(active.reward);
    const done = active.endsAt.getTime() <= Date.now();
    return (
      <div className="situation-card">
        <p className="text-xs font-bold uppercase text-jade">{done ? "Hoạt động hoàn thành" : "Hoạt động đang diễn ra"}</p>
        <h3>{activityCopy[mode].title}</h3>
        <p className="muted">{done ? "Hoạt động đã kết thúc. Xem kết quả để lưu tình huống hiện tại." : activityCopy[mode].description}</p>
        <ActivityCountdown startedAt={active.startedAt.toISOString()} endsAt={active.endsAt.toISOString()} />
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={claimExploreAction}>
            <input type="hidden" name="id" value={active.id} />
            <button className="btn" disabled={!done}>{done ? "Xem kết quả" : "Đang xử lý"}</button>
          </form>
          {!done ? (
            <form action={cancelExploreAction}>
              <input type="hidden" name="id" value={active.id} />
              <button className="btn btn-secondary">Hủy hoạt động</button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  if (pending) {
    const reward = parseReward(pending.reward);
    const monster = typeof reward.monster === "string" ? monsterByKey.get(reward.monster) : null;
    return (
      <div className="situation-card">
        <p className="text-xs font-bold uppercase text-jade">Phát hiện con mồi</p>
        <h3>{monster?.name ?? "Dấu vết yêu thú"}</h3>
        <div className="info-table mt-4">
          <div><span>Cảnh giới</span><b>Bậc {monster?.realmOrder ?? "?"}</b></div>
          <div><span>HP</span><b>{monster ? `${monster.hp}/${monster.hp}` : "Chưa rõ"}</b></div>
          <div><span>Nguy hiểm</span><b>Thấp</b></div>
        </div>
        <p className="muted mt-3">Bạn muốn chủ động giao chiến hay rút lui khỏi dấu vết này?</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={attackEncounterAction}>
            <input type="hidden" name="id" value={pending.id} />
            <button className="btn">Tấn công</button>
          </form>
          <form action={leaveEncounterAction}>
            <input type="hidden" name="id" value={pending.id} />
            <button className="btn btn-secondary">Rút lui</button>
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
    const itemName = typeof reward.item === "string" ? itemNames.get(reward.item) ?? reward.item : null;
    const mode = activityModeFromReward(latest.reward);
    return (
      <div className="situation-card">
        <p className="text-xs font-bold uppercase text-jade">Kết quả gần nhất</p>
        <h3>{activityCopy[mode].title} hoàn thành</h3>
        {itemName ? <p className="mt-2"><b className="text-gold">{itemName}</b> x{typeof reward.quantity === "number" ? reward.quantity : 1}</p> : null}
        {combat.winner ? <p className="mt-2">{combat.winner === "player" ? "Bạn đã đánh bại yêu thú." : "Bạn rút khỏi trận chiến sau khi bị thương."}</p> : null}
        {typeof loot.linhThach === "string" && loot.linhThach !== "0" ? <p className="mt-2 text-gold">Linh thạch +{loot.linhThach}</p> : null}
        {lootItems.length > 0 ? (
          <div className="item-stat-list mt-3">
            {lootItems.map((entry, index) => {
              const row = parseReward(entry);
              return <span key={index}>{String(row.name ?? row.key ?? "Chiến lợi phẩm")} <b>x{String(row.quantity ?? 1)}</b></span>;
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
