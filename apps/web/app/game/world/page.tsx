import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimExploreAction, claimTravelAction, exploreAction, startTravelAction } from "@/lib/forms";
import { explorationEnergyCost, recordOnboardingEvent } from "@ttg/game";
import Link from "next/link";

const exploreOptions = [
  { minutes: 10, risk: "Thấp", reward: "Tài nguyên nhỏ", encounter: "Hiếm" },
  { minutes: 30, risk: "Vừa", reward: "Tài nguyên khá", encounter: "Có thể" },
  { minutes: 60, risk: "Cao", reward: "Tài nguyên tốt", encounter: "Dễ gặp" }
];

export default async function WorldPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      explorations: { where: { status: "ACTIVE" } },
      travels: { where: { status: "ACTIVE" }, include: { route: { include: { origin: true, destination: true } } }, orderBy: { endsAt: "desc" } },
      location: true,
      currentLocation: { include: { zone: { include: { region: true } } } }
    }
  });
  const [worlds, activityLogs] = await Promise.all([
    prisma.world.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        regions: {
          orderBy: { order: "asc" },
          include: {
            zones: {
              orderBy: { dangerLevel: "asc" },
              include: {
                locations: {
                  where: { active: true },
                  orderBy: { name: "asc" },
                  include: { routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } } }
                }
              }
            }
          }
        }
      }
    }),
    prisma.gameLog.findMany({ where: { characterId: c.id, type: { in: ["travel", "exploration", "encounter"] } }, take: 6, orderBy: { createdAt: "desc" } })
  ]);
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");
  const currentLocation = c.currentLocation;
  const currentServices = currentLocation?.services ?? [];
  const canExplore = currentServices.includes("explore") || currentServices.includes("pve");
  const currentLocationNode = worlds
    .flatMap((world) => world.regions)
    .flatMap((region) => region.zones)
    .flatMap((zone) => zone.locations)
    .find((location) => location.id === c.currentLocationId);
  const currentRoutes = currentLocationNode?.routesFrom ?? [];
  const locationName = currentLocation?.name ?? c.location?.name ?? "Chưa rõ";
  const regionName = currentLocation?.zone.region?.name ?? "Chưa rõ địa vực";
  const zoneName = currentLocation?.zone.name ?? c.location?.name ?? "Chưa rõ khu vực";
  return (
    <div className="world-page p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">World loop</p>
        <h1 className="mt-1 text-3xl font-black">Thế Giới</h1>
        <p className="muted mt-2 max-w-3xl">
          Mỗi địa điểm có việc làm riêng. Ở trong thành thì giao dịch, nhận tin, chuẩn bị hành trang; ra ngoại vực mới có lịch luyện, biến cố và dấu vết yêu thú.
        </p>
      </header>

      <section className="location-hero">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Vị trí hiện tại</p>
          <h2>{locationName}</h2>
          <p className="muted mt-2">{currentLocation?.description ?? "Chưa có mô tả địa điểm."}</p>
        </div>
        <div className="location-meta">
          <span><b>Địa vực</b>{regionName}</span>
          <span><b>Khu vực</b>{zoneName}</span>
          <span><b>An ninh</b>{currentLocation?.securityLevel ?? "Không rõ"}</span>
          <span><b>Dịch vụ</b>{currentServices.length ? currentServices.join(", ") : "Chưa rõ"}</span>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel title="Việc có thể làm tại đây">
          {canExplore ? (
            <div className="action-grid">
              {exploreOptions.map((option) => (
                <form key={option.minutes} action={exploreAction} className="action-card">
                  <input type="hidden" name="minutes" value={option.minutes} />
                  <div>
                    <b>Lịch luyện {option.minutes} phút</b>
                    <small>Tốn {explorationEnergyCost(option.minutes)} thể lực · Rủi ro {option.risk}</small>
                  </div>
                  <div className="meta-row">
                    <span>Thưởng: {option.reward}</span>
                    <span>Gặp yêu thú: {option.encounter}</span>
                  </div>
                  <button className="btn btn-secondary w-full">Bắt đầu</button>
                </form>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>{locationName} là khu an toàn.</b>
              <p>Không thể tùy ý săn yêu thú hoặc thám hiểm trong khu này. Hãy đi tới cổng thành, quan đạo hoặc ngoại vực để mở lịch luyện.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/game/market" className="btn btn-secondary">Giao dịch ở chợ</Link>
                <Link href="/game" className="btn">Về tổng quan</Link>
              </div>
            </div>
          )}

          {c.explorations.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {c.explorations.map((e) => (
                <form key={e.id} action={claimExploreAction} className="activity-row">
                  <input type="hidden" name="id" value={e.id} />
                  <span><b>Đang lịch luyện</b><small>Kết thúc {e.endsAt.toLocaleString("vi-VN")}</small></span>
                  <button className="btn min-h-0 px-3 py-1 text-xs">Nhận</button>
                </form>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel title="Biến cố gần đây">
          <div className="event-list">
            {activityLogs.map((log) => <p key={log.id}>{log.message}</p>)}
            {activityLogs.length === 0 ? <p className="muted">Chưa có biến cố. Hãy di chuyển hoặc lịch luyện để mở nhật ký thế giới.</p> : null}
          </div>
          <div className="mt-5 rounded border border-white/10 bg-black/20 p-4">
            <h3 className="font-bold text-gold">Yêu Thú Đồ Giám</h3>
            <p className="muted mt-2 text-sm">Yêu thú được ghi nhận từ lịch luyện và biến cố trên đường, không phải danh sách đứng sẵn trong thành.</p>
            <Link href="/game/bestiary" className="btn btn-secondary mt-3">Mở Đồ Giám</Link>
          </div>
        </Panel>
      </section>

      <Panel title="Tuyến đường từ vị trí hiện tại" className="mt-5">
        {c.travels.length > 0 ? (
          <div className="grid gap-3">
            {c.travels.map((travel) => (
              <form key={travel.id} action={claimTravelAction} className="route-card">
                <input type="hidden" name="id" value={travel.id} />
                <div>
                  <b>{travel.route.origin.name} -&gt; {travel.route.destination.name}</b>
                  <small>Tới lúc {travel.endsAt.toLocaleString("vi-VN")}</small>
                </div>
                <button className="btn">Hoàn tất</button>
              </form>
            ))}
          </div>
        ) : currentRoutes.length > 0 ? (
          <div className="route-grid">
            {currentRoutes.map((route) => (
              <form key={route.id} action={startTravelAction} className="route-card">
                <input type="hidden" name="routeId" value={route.id} />
                <div>
                  <b>{route.destination.name}</b>
                  <small>{route.travelMinutes} phút · {route.travelCost.toString()} linh thạch · nguy hiểm {route.dangerLevel}</small>
                </div>
                <span className="badge">{route.ambushAllowed ? "Có phục kích" : "An toàn hơn"}</span>
                <button className="btn btn-secondary">Đi</button>
              </form>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <b>Không có tuyến đường trực tiếp.</b>
            <p>Địa điểm này chưa mở đường đi tiếp. Kiểm tra bản đồ đã biết bên dưới hoặc quay lại khu vực có cổng dịch chuyển.</p>
          </div>
        )}
      </Panel>

      <section className="mt-6 space-y-5">
        <h2 className="text-xl font-black text-gold">Bản đồ đã biết</h2>
        {worlds.map((world) => (
          <article key={world.id} className="panel rounded-lg p-5">
            <h3 className="text-2xl font-bold text-gold">{world.name}</h3>
            <p className="muted mt-2">{world.description}</p>
            <div className="mt-5 grid gap-5">
              {world.regions.map((region) => (
                <section key={region.id} className="rounded-md border border-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{region.name}</h3>
                      <p className="muted text-sm">{region.description}</p>
                    </div>
                    <span className="rounded border border-jade/25 px-2 py-1 text-xs text-jade">Luật vực: {region.lawLevel}</span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {region.zones.map((zone) => (
                      <div key={zone.id} className="rounded-md bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-bold">{zone.name}</h4>
                          <span className="text-xs text-paper/65">Nguy hiểm {zone.dangerLevel}</span>
                        </div>
                        <p className="muted mt-2 text-sm">{zone.description}</p>
                        <div className="mt-3 space-y-3">
                          {zone.locations.map((location) => (
                            <div key={location.id} className="rounded border border-white/10 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold">{location.name}</p>
                                  <p className="muted text-xs">{location.kind} · an ninh {location.securityLevel}</p>
                                </div>
                                <p className="text-xs text-paper/65">{location.services.join(", ")}</p>
                              </div>
                              {location.routesFrom.length > 0 ? (
                                <div className="mt-3 grid gap-2">
                                  {location.routesFrom.map((route) => <p key={route.id} className="muted text-xs">{location.name} -&gt; {route.destination.name} · {route.travelMinutes}p · nguy hiểm {route.dangerLevel}</p>)}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
        {worlds.length === 0 ? <div className="panel rounded-lg p-6 muted">Chưa có dữ liệu world graph. Hãy chạy seed.</div> : null}
      </section>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel rounded-lg p-5 ${className}`}>
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
