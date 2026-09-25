import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimExploreAction, exploreAction, startTravelAction } from "@/lib/forms";
import { formatLocationKind, formatSecurity, formatService } from "@/lib/format";
import { currentEnergy, explorationEnergyCost, recordOnboardingEvent } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
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

const activityCopy: Record<LocationActivityMode, { title: string; cta: string; minutes: number; description: string; icon: React.ReactNode }> = {
  explore: { title: "Khám phá", cta: "Khám phá", minutes: 10, description: "Tìm lối mòn, dấu vết, khu vực ẩn hoặc cơ duyên phù hợp địa hình.", icon: <Compass size={18} aria-hidden /> },
  hunt: { title: "Săn bắn", cta: "Đi săn", minutes: 15, description: "Theo dấu sinh vật trong khu vực. Kết quả chỉ phát hiện mục tiêu, không tự động chiến đấu.", icon: <Swords size={18} aria-hidden /> },
  gather: { title: "Thu thập", cta: "Thu thập", minutes: 10, description: "Tìm dược liệu, linh mộc, khoáng thạch hoặc tài nguyên tự nhiên của khu vực.", icon: <Trees size={18} aria-hidden /> }
};

export default async function LocationPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      explorations: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      travels: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      currentLocation: { include: { zone: { include: { region: true } }, routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } } } },
      location: true
    }
  });
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");
  const location = c.currentLocation;
  const services = location?.services ?? [];
  const hasActiveActivity = c.explorations.length + c.cultivationJobs.length + c.travels.length > 0;
  const energy = currentEnergy(c);
  const activities = getLocationActivities(services);
  const facilities = getLocationFacilities(services, location?.kind);
  const routes = location?.routesFrom ?? [];
  const logs = await prisma.gameLog.findMany({
    where: { characterId: c.id, type: { in: ["exploration", "encounter"] } },
    take: 6,
    orderBy: { createdAt: "desc" }
  });

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
                      <small>{route.travelMinutes} phút · {route.travelCost.toString()} linh thạch · nguy hiểm {route.dangerLevel}</small>
                    </div>
                    <button className="btn btn-secondary" disabled={hasActiveActivity}>{hasActiveActivity ? "Đang bận" : "Đi tới"}</button>
                  </form>
                ))}
              </div>
            </Panel>
          ) : null}

          {activities.length > 0 ? (
            <Panel title="Hoạt động tại đây">
            <div className="action-grid">
              {activities.map((mode) => (
                <ExploreForm key={mode} mode={mode} disabled={hasActiveActivity || energy < explorationEnergyCost(activityCopy[mode].minutes)} reason={hasActiveActivity ? "Đang có hoạt động" : energy < explorationEnergyCost(activityCopy[mode].minutes) ? "Thiếu thể lực" : activityCopy[mode].cta} />
              ))}
            </div>
            </Panel>
          ) : null}

          {c.explorations.length > 0 ? (
            <Panel title="Hoạt động đang chạy">
              <div className="grid gap-3">
              {c.explorations.map((e) => (
                <form key={e.id} action={claimExploreAction} className="activity-row">
                  <input type="hidden" name="id" value={e.id} />
                  <span><b>Hoạt động đang chạy</b><small>Kết thúc {e.endsAt.toLocaleString("vi-VN")}</small></span>
                  <button className="btn min-h-0 px-3 py-1 text-xs">Nhận</button>
                </form>
              ))}
              </div>
            </Panel>
          ) : null}

          {facilities.length === 0 && routes.length === 0 && activities.length === 0 ? (
            <Panel title="Không có hành động trực tiếp">
              <div className="empty-state">
                <b>Địa điểm này chưa mở gameplay.</b>
                <p>Hãy mở Thế Giới để di chuyển tới nơi có cơ sở hoặc hoạt động phù hợp.</p>
                <Link href="/game/world" className="btn mt-4">Chọn địa điểm khác</Link>
              </div>
            </Panel>
          ) : null}
        </div>

        <Panel title="Nhật ký địa điểm">
          <div className="event-list">
            {logs.map((log) => <p key={log.id}>{log.message}</p>)}
            {logs.length === 0 ? <p className="muted">Chưa có ghi chép tại địa điểm này.</p> : null}
          </div>
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
  if (services.includes("inn")) facilities.push({ key: "inn", label: "Khách điếm", description: "Cơ chế nghỉ ngơi chưa được nối backend.", disabled: true, icon: <Home size={18} aria-hidden /> });
  if (services.includes("auction")) facilities.push({ key: "auction", label: "Đấu giá", description: "Auction có schema nhưng workflow đặt giá chưa hoàn thiện.", disabled: true, icon: <Landmark size={18} aria-hidden /> });
  if (services.includes("caravan")) facilities.push({ key: "caravan", label: "Tiêu cục", description: "Escort/delivery chưa có backend riêng.", disabled: true, icon: <Route size={18} aria-hidden /> });
  if (services.includes("formation")) facilities.push({ key: "formation", label: "Trận pháp", description: "Trận pháp đang chờ workflow nghề/công pháp.", disabled: true, icon: <Shield size={18} aria-hidden /> });
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
  const cost = explorationEnergyCost(config.minutes);
  return (
    <form action={exploreAction} className="action-card">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="minutes" value={config.minutes} />
      <div>
        <span className="facility-card-title">{config.icon}<b>{config.title}</b></span>
        <small>{config.minutes} phút · tốn {cost} thể lực</small>
      </div>
      <p className="muted text-sm">{config.description}</p>
      <button className="btn btn-secondary w-full" disabled={disabled}>{reason}</button>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
