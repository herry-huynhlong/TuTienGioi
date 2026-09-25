import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimTravelAction, startTravelAction } from "@/lib/forms";
import { recordOnboardingEvent } from "@ttg/game";
import Link from "next/link";

type MapPoint = { x: number; y: number; icon: string; hint?: string };

const mapPoints: Record<string, MapPoint> = {
  "thanh-van-dong-thanh": { x: 50, y: 72, icon: "◎", hint: "Thành thị" },
  "thanh-truc-lam": { x: 50, y: 50, icon: "●", hint: "Rừng" },
  "thanh-van-son": { x: 50, y: 25, icon: "▲", hint: "Núi" },
  "linh-khe": { x: 50, y: 90, icon: "◆", hint: "Suối" },
  "hac-phong-coc": { x: 25, y: 45, icon: "◇", hint: "Cốc" },
  "cho-linh-bao": { x: 70, y: 74, icon: "◆", hint: "Chợ" },
  "bac-mon": { x: 50, y: 62, icon: "◇", hint: "Cổng" },
  "thanh-van-quan-dao": { x: 50, y: 44, icon: "●", hint: "Quan đạo" },
  "hac-son-chan-nui": { x: 37, y: 32, icon: "▲", hint: "Ngoại vực" },
  "thanh-linh-son-mon": { x: 58, y: 18, icon: "▲", hint: "Sơn môn" }
};

function fallbackPoint(index: number): MapPoint {
  const ring = index % 10;
  return { x: 18 + (ring % 5) * 16, y: 24 + Math.floor(ring / 5) * 34, icon: "●" };
}

export default async function WorldPage({ searchParams }: { searchParams?: Promise<{ region?: string; location?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      travels: { where: { status: "ACTIVE" }, include: { route: { include: { origin: true, destination: true } } }, orderBy: { endsAt: "desc" } },
      location: true,
      currentLocation: { include: { zone: { include: { region: true } } } },
      realmStage: { include: { realm: true } }
    }
  });
  const worlds = await prisma.world.findMany({
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
                include: {
                  routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } }
                }
              }
            }
          }
        }
      }
    }
  });
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");

  const regions = worlds.flatMap((world) => world.regions.map((region) => ({ ...region, worldName: world.name })));
  const currentRegionKey = c.currentLocation?.zone.region?.key;
  const activeRegion = regions.find((region) => region.key === params?.region) ?? regions.find((region) => region.key === currentRegionKey) ?? regions[0];
  const locations = activeRegion?.zones.flatMap((zone) => zone.locations.map((location) => ({ ...location, zone }))) ?? [];
  const currentRoutes = locations.find((location) => location.id === c.currentLocationId)?.routesFrom ?? [];
  const availableDestinationIds = new Set(currentRoutes.map((route) => route.destinationId));
  const selectedLocation =
    locations.find((location) => location.key === params?.location) ??
    locations.find((location) => location.id === c.currentLocationId) ??
    locations[0];
  const selectedRoute = currentRoutes.find((route) => route.destinationId === selectedLocation?.id);
  const currentLocationName = c.currentLocation?.name ?? c.location?.name ?? "Chưa rõ";

  return (
    <div className="world-map-page p-5 lg:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-bold uppercase text-jade">World map</p>
          <h1 className="mt-1 text-3xl font-black">Thế Giới</h1>
          <p className="muted mt-2 max-w-3xl">Bản đồ chỉ trả lời: bạn đang ở đâu và có thể đi đâu. Hoạt động như khám phá, săn yêu, thu thập nằm trong trang địa điểm.</p>
        </div>
        <Link href="/game/location" className="btn btn-secondary">Địa điểm hiện tại</Link>
      </header>

      <div className="region-tabs">
        {regions.map((region) => (
          <Link key={region.id} href={`/game/world?region=${region.key}`} className={region.id === activeRegion?.id ? "active" : ""}>
            {region.name}
          </Link>
        ))}
      </div>

      {activeRegion ? (
        <section className="world-map-layout mt-5">
          <div className="fantasy-map">
            <div className="map-heading">
              <div>
                <p className="text-xs font-bold uppercase text-jade">{activeRegion.worldName}</p>
                <h2>{activeRegion.name}</h2>
              </div>
              <span>Đang ở: {currentLocationName}</span>
            </div>

            <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {locations.flatMap((origin, originIndex) => {
                const originPoint = mapPoints[origin.key] ?? fallbackPoint(originIndex);
                return origin.routesFrom.flatMap((route) => {
                  const destinationIndex = locations.findIndex((location) => location.id === route.destinationId);
                  if (destinationIndex < 0) return [];
                  const destination = locations[destinationIndex]!;
                  const destinationPoint = mapPoints[destination.key] ?? fallbackPoint(destinationIndex);
                  return <line key={route.id} x1={originPoint.x} y1={originPoint.y} x2={destinationPoint.x} y2={destinationPoint.y} />;
                });
              })}
            </svg>

            {locations.map((location, index) => {
              const point = mapPoints[location.key] ?? fallbackPoint(index);
              const state = getLocationState(location.id, location.key, c.currentLocationId, availableDestinationIds);
              const href = `/game/world?region=${activeRegion.key}&location=${location.key}`;
              return (
                <Link
                  key={location.id}
                  href={href}
                  className={`map-node map-node-${state} ${selectedLocation?.id === location.id ? "map-node-selected" : ""}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <span className="map-node-icon">{state === "locked" ? "?" : point.icon}</span>
                  <span className="map-node-label">{location.name}</span>
                  <small>{state === "current" ? "Bạn đang ở đây" : state === "available" ? "Có thể đi tới" : state === "locked" ? "Chưa mở khóa" : point.hint ?? "Đã biết"}</small>
                </Link>
              );
            })}
          </div>

          <aside className="map-detail">
            {c.travels.length > 0 ? (
              <div className="travel-status">
                <h2>Đang di chuyển</h2>
                {c.travels.map((travel) => (
                  <form key={travel.id} action={claimTravelAction} className="route-card">
                    <input type="hidden" name="id" value={travel.id} />
                    <div>
                      <b>{travel.route.origin.name} -&gt; {travel.route.destination.name}</b>
                      <small>Còn tới {travel.endsAt.toLocaleString("vi-VN")}</small>
                    </div>
                    <button className="btn">Hoàn tất</button>
                  </form>
                ))}
              </div>
            ) : selectedLocation ? (
              <LocationDetail
                currentLocationId={c.currentLocationId}
                location={selectedLocation}
                route={selectedRoute ?? null}
                realmName={`${c.realmStage.realm.name} ${c.realmStage.name}`}
                isLocked={!selectedRoute && selectedLocation.id !== c.currentLocationId}
              />
            ) : null}
          </aside>
        </section>
      ) : (
        <div className="panel mt-5 rounded-lg p-6 muted">Chưa có dữ liệu bản đồ. Hãy chạy seed.</div>
      )}
    </div>
  );
}

function getLocationState(locationId: string, locationKey: string, currentLocationId: string | null, availableDestinationIds: Set<string>) {
  if (locationId === currentLocationId) return "current";
  if (availableDestinationIds.has(locationId)) return "available";
  if (locationKey === "hac-phong-coc") return "locked";
  return "discovered";
}

function LocationDetail({
  currentLocationId,
  location,
  route,
  realmName,
  isLocked
}: {
  currentLocationId: string | null;
  location: {
    id: string;
    name: string;
    description: string;
    kind: string;
    securityLevel: string;
    services: string[];
    zone: { name: string; dangerLevel: number };
  };
  route?: { id: string; travelMinutes: number; travelCost: bigint; dangerLevel: number; ambushAllowed: boolean } | null;
  realmName: string;
  isLocked: boolean;
}) {
  const isCurrent = location.id === currentLocationId;
  return (
    <div>
      <p className="text-xs font-bold uppercase text-jade">Location detail</p>
      <h2>{location.name}</h2>
      <p className="muted mt-2">{location.description}</p>
      <div className="info-table mt-4">
        <div><span>Khu vực</span><b>{location.zone.name}</b></div>
        <div><span>Khoảng cách</span><b>{isCurrent ? "Đang đứng tại đây" : route ? `${route.travelMinutes} phút` : "Chưa có tuyến trực tiếp"}</b></div>
        <div><span>Nguy hiểm</span><b>{route ? `Cấp ${route.dangerLevel}` : `Khu vực ${location.zone.dangerLevel}`}</b></div>
        <div><span>Cảnh giới đề nghị</span><b>{realmName}</b></div>
        <div><span>Đặc điểm</span><b>{location.kind} · {location.securityLevel}</b></div>
      </div>

      {isCurrent ? (
        <Link href="/game/location" className="btn mt-4 w-full">Vào địa điểm</Link>
      ) : route ? (
        <form action={startTravelAction} className="mt-4">
          <input type="hidden" name="routeId" value={route.id} />
          <button className="btn w-full">Đi tới</button>
          <p className="muted mt-2 text-sm">Chi phí {route.travelCost.toString()} linh thạch{route.ambushAllowed ? " · có thể gặp biến cố trên đường" : ""}.</p>
        </form>
      ) : (
        <button className="btn mt-4 w-full" disabled>{isLocked ? "Chưa mở tuyến đường" : "Không thể đi"}</button>
      )}
    </div>
  );
}
