import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimExploreAction, claimTravelAction, exploreAction, fightAction, startTravelAction } from "@/lib/forms";

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
  const [worlds, monsters, travelLogs] = await Promise.all([
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
    prisma.monster.findMany({ take: 8 }),
    prisma.gameLog.findMany({ where: { characterId: c.id, type: "travel" }, take: 5, orderBy: { createdAt: "desc" } })
  ]);
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-3xl font-black">Thế Giới</h1>
      <p className="muted mt-2">Đang ở {c.currentLocation?.name ?? c.location?.name} · {c.currentLocation?.zone.region?.name ?? "Chưa rõ địa vực"}. Chọn tuyến đường khả dụng để di chuyển, nhận encounter và cập nhật vị trí khi tới nơi.</p>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_.85fr]">
        <div className="panel rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">Thám hiểm</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {[10, 30, 60].map((m) => <form key={m} action={exploreAction}><input type="hidden" name="minutes" value={m} /><button className="btn btn-secondary">{m} phút</button></form>)}
          </div>
          <div className="mt-4 space-y-3">
            {c.explorations.map((e) => <form key={e.id} action={claimExploreAction} className="flex justify-between rounded-md bg-white/5 p-3"><input type="hidden" name="id" value={e.id} /><span className="muted">{e.endsAt.toLocaleString("vi-VN")}</span><button className="btn">Nhận</button></form>)}
          </div>
        </div>
        <div className="panel rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">Yêu thú</h2>
          <div className="mt-4 grid gap-3">{monsters.map((m) => <form key={m.id} action={fightAction} className="flex items-center justify-between rounded-md bg-white/5 p-3"><input type="hidden" name="monster" value={m.key} /><span>{m.name}</span><button className="btn btn-secondary">Khiêu chiến</button></form>)}</div>
        </div>
      </section>
      <section className="panel mt-6 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gold">Di chuyển</h2>
        {c.travels.length > 0 ? (
          <div className="mt-4 space-y-3">
            {c.travels.map((travel) => (
              <form key={travel.id} action={claimTravelAction} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/5 p-3">
                <input type="hidden" name="id" value={travel.id} />
                <span className="muted">{travel.route.origin.name} → {travel.route.destination.name} · tới lúc {travel.endsAt.toLocaleString("vi-VN")}</span>
                <button className="btn">Hoàn tất</button>
              </form>
            ))}
          </div>
        ) : (
          <p className="muted mt-3">Chọn một tuyến đường bên dưới để bắt đầu di chuyển. Server sẽ lưu thời gian đi và chỉ cập nhật vị trí khi bạn hoàn tất chuyến đi.</p>
        )}
        {travelLogs.length > 0 ? (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="font-bold">Nhật ký di chuyển</h3>
            <div className="mt-3 space-y-2">
              {travelLogs.map((log) => <p key={log.id} className="muted text-sm">{log.message}</p>)}
            </div>
          </div>
        ) : null}
      </section>
      <section className="mt-6 space-y-6">
        {worlds.map((world) => (
          <article key={world.id} className="panel rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gold">{world.name}</h2>
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
                                  {location.routesFrom.map((route) => (
                                    <form key={route.id} action={startTravelAction} className="flex flex-wrap items-center justify-between gap-2 rounded bg-black/20 px-3 py-2 text-sm">
                                      <input type="hidden" name="routeId" value={route.id} />
                                      <span>{route.destination.name}</span>
                                      <span className="muted">{route.travelMinutes}p · {route.travelCost.toString()} LT · nguy hiểm {route.dangerLevel}{route.ambushAllowed ? " · mai phục" : ""}</span>
                                      <button className="btn btn-secondary min-h-0 px-3 py-1 text-xs" disabled={c.currentLocationId !== location.id || c.travels.length > 0}>Đi</button>
                                    </form>
                                  ))}
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
