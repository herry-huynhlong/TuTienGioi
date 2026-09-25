import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimTravelAction, startTravelAction } from "@/lib/forms";
import { formatLocationKind, formatSecurity, formatService } from "@/lib/format";
import { getFeatureUnlockState, recordOnboardingEvent } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";

type DiscoveryState = "current" | "reachable" | "known_unreachable" | "locked" | "unknown";
type QuickFeatureKey = "character" | "market" | "bestiary" | "sect";
type QuickLink = { label: string; href: string; featureKey?: QuickFeatureKey };

const publicKnownLocationKeys = new Set([
  "thanh-van-dong-thanh",
  "cho-linh-bao",
  "bac-mon",
  "thanh-truc-lam",
  "linh-khe",
  "thanh-van-son",
  "thanh-linh-son-mon"
]);

const areaOrder: Record<string, number> = {
  "thanh-van-thanh": 10,
  "hac-son": 20,
  "thanh-linh-son-mach": 30
};

const locationOrder: Record<string, number> = {
  "thanh-van-dong-thanh": 10,
  "cho-linh-bao": 20,
  "bac-mon": 30,
  "thanh-truc-lam": 40,
  "linh-khe": 50,
  "thanh-van-son": 60,
  "thanh-linh-son-mon": 70,
  "hac-phong-coc": 80
};

const locationGlyph: Record<string, string> = {
  district: "◎",
  market: "◇",
  gate: "◇",
  road: "·",
  wilds: "●",
  forest: "●",
  mountain: "▲",
  river: "~",
  valley: "◇",
  sect_land: "△",
  harbor: "◇",
  resource: "◆",
  outpost: "◇",
  ruin: "□",
  city_hub: "◎"
};

const quickLinks: QuickLink[] = [
  { label: "Nhân vật", href: "/game/character", featureKey: "character" },
  { label: "Túi đồ", href: "/game/inventory", featureKey: "character" },
  { label: "Công pháp", href: "/game/techniques", featureKey: "character" },
  { label: "Chợ", href: "/game/market", featureKey: "market" },
  { label: "Đồ giám", href: "/game/bestiary", featureKey: "bestiary" },
  { label: "Xếp hạng", href: "/game/leaderboard" },
  { label: "Tông môn", href: "/game/sect", featureKey: "sect" }
];

export default async function WorldPage({ searchParams }: { searchParams?: Promise<{ region?: string; location?: string; error?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      travels: { where: { status: "ACTIVE" }, include: { route: { include: { origin: true, destination: true } } }, orderBy: { endsAt: "desc" } },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      explorations: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      location: true,
      currentLocation: { include: { zone: { include: { region: true } } } },
      realmStage: { include: { realm: true } }
    }
  });
  const [worlds, featureUnlocks] = await Promise.all([
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
                  include: {
                    routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } }
                  }
                }
              }
            }
          }
        }
      }
    }),
    getFeatureUnlockState(prisma, c.id)
  ]);
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");

  const regions = worlds.flatMap((world) => world.regions.map((region) => ({ ...region, worldName: world.name })));
  const currentRegionKey = c.currentLocation?.zone.region?.key;
  const knownRegionKeys = new Set([currentRegionKey, "thanh-van-vuc"].filter(Boolean));
  const activeRegion =
    regions.find((region) => region.key === params?.region && knownRegionKeys.has(region.key)) ??
    regions.find((region) => region.key === currentRegionKey) ??
    regions.find((region) => region.key === "thanh-van-vuc") ??
    regions[0];
  const currentLocationId = c.currentLocationId;
  const zones = [...(activeRegion?.zones ?? [])].sort((a, b) => (areaOrder[a.key] ?? 999) - (areaOrder[b.key] ?? 999) || a.name.localeCompare(b.name));
  const currentLocation = zones.flatMap((zone) => zone.locations).find((location) => location.id === currentLocationId);
  const currentRoutes = currentLocation?.routesFrom ?? [];
  const routeByDestinationId = new Map(currentRoutes.map((route) => [route.destinationId, route]));
  const currentRealmOrder = c.realmStage.realm.order;
  const knownLocationIds = new Set<string>([
    ...(currentLocationId ? [currentLocationId] : []),
    ...currentRoutes.map((route) => route.destinationId),
    ...zones.flatMap((zone) => zone.locations.filter((location) => publicKnownLocationKeys.has(location.key)).map((location) => location.id))
  ]);
  const allLocations = zones.flatMap((zone) => zone.locations.map((location) => ({ ...location, zone })));
  const selectedLocation =
    allLocations.find((location) => location.key === params?.location && getLocationState(location, currentLocationId, knownLocationIds, routeByDestinationId, currentRealmOrder) !== "unknown") ??
    allLocations.find((location) => location.id === currentLocationId) ??
    allLocations.find((location) => getLocationState(location, currentLocationId, knownLocationIds, routeByDestinationId, currentRealmOrder) !== "unknown");
  const selectedRoute = selectedLocation ? routeByDestinationId.get(selectedLocation.id) : null;
  const currentLocationName = c.currentLocation?.name ?? c.location?.name ?? "Chưa rõ";
  const travelBlockedByActivity = c.cultivationJobs.length + c.explorations.length + c.travels.length > 0;

  return (
    <div className="world-directory-page p-5 lg:p-8">
      <header className="world-directory-header">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Thế Giới</p>
          <h1>Thế Giới</h1>
          <p className="muted mt-2">{activeRegion?.name ?? "Chưa rõ địa vực"} · {currentLocationName}</p>
        </div>
        <Link href="/game/location" className="btn btn-secondary">Địa điểm hiện tại</Link>
      </header>
      <ActionAlert message={params?.error} />

      <div className="region-tabs mt-5">
        {regions.map((region) => knownRegionKeys.has(region.key) ? (
          <Link key={region.id} href={`/game/world?region=${region.key}`} className={region.id === activeRegion?.id ? "active" : ""}>{region.name}</Link>
        ) : (
          <span key={region.id} className="unknown">???</span>
        ))}
      </div>

      {activeRegion ? (
        <section className="world-directory-layout mt-5">
          <div className="world-directory-panel">
            <div className="directory-title">
              <span>Bản đồ / Địa điểm</span>
              <small>{activeRegion.name}</small>
            </div>
            <div className="directory-areas">
              {zones.map((zone) => (
                <section key={zone.id} className="directory-area">
                  <h2>{zone.name}</h2>
                  <div className="directory-location-grid">
                    {[...zone.locations]
                      .sort((a, b) => (locationOrder[a.key] ?? 999) - (locationOrder[b.key] ?? 999) || a.name.localeCompare(b.name))
                      .map((location) => {
                        const state = getLocationState(location, currentLocationId, knownLocationIds, routeByDestinationId, currentRealmOrder);
                        return (
                          <LocationRow
                            key={location.id}
                            activeRegionKey={activeRegion.key}
                            location={location}
                            selected={selectedLocation?.id === location.id}
                            state={state}
                          />
                        );
                      })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <aside className="world-side-panel">
            <section className="quick-link-panel">
              <div className="directory-title">
                <span>Truy cập nhanh</span>
                <small>Chức năng</small>
              </div>
              <div className="quick-link-list">
                {quickLinks.map((link) => {
                  const unlocked = !link.featureKey || featureUnlocks[link.featureKey]?.unlocked !== false;
                  return unlocked ? (
                    <Link key={link.label} href={link.href}>{link.label}</Link>
                  ) : (
                    <span key={link.label}>{link.label}<small>Sau</small></span>
                  );
                })}
              </div>
            </section>

            <section className="location-detail-panel">
              {c.travels.length > 0 ? (
                <TravelStatus travels={c.travels} />
              ) : selectedLocation ? (
                <LocationDetail
                  currentLocationId={currentLocationId}
                  location={selectedLocation}
                  route={selectedRoute ?? null}
                  realmName={`${c.realmStage.realm.name} ${c.realmStage.name}`}
                  isLocked={Boolean(selectedRoute && selectedRoute.minimumRealmOrder > currentRealmOrder)}
                  activityLocked={travelBlockedByActivity}
                />
              ) : (
                <div className="empty-state"><b>Chưa chọn địa điểm.</b><p>Chọn một địa điểm đã biết trong danh sách để xem chi tiết.</p></div>
              )}
            </section>
          </aside>
        </section>
      ) : (
        <div className="panel mt-5 rounded-lg p-6 muted">Chưa có dữ liệu bản đồ. Hãy chạy seed.</div>
      )}
    </div>
  );
}

function getLocationState(
  location: { id: string; minimumRealmOrder: number },
  currentLocationId: string | null,
  knownLocationIds: Set<string>,
  routeByDestinationId: Map<string, { minimumRealmOrder: number }>,
  currentRealmOrder: number
): DiscoveryState {
  if (location.id === currentLocationId) return "current";
  const route = routeByDestinationId.get(location.id);
  if (route) return route.minimumRealmOrder > currentRealmOrder ? "locked" : "reachable";
  if (knownLocationIds.has(location.id)) return "known_unreachable";
  return "unknown";
}

function LocationRow({
  activeRegionKey,
  location,
  selected,
  state
}: {
  activeRegionKey: string;
  location: { key: string; name: string; kind: string };
  selected: boolean;
  state: DiscoveryState;
}) {
  if (state === "unknown") {
    return (
      <div className="directory-location-row directory-location-unknown" title="Bạn chưa biết nơi này.">
        <span className="directory-location-icon">?</span>
        <span className="directory-location-name">???</span>
      </div>
    );
  }

  const glyph = state === "locked" ? "◇" : state === "current" ? "◎" : locationGlyph[location.kind] ?? "◇";
  return (
    <Link
      href={`/game/world?region=${activeRegionKey}&location=${location.key}`}
      className={`directory-location-row directory-location-${state} ${selected ? "selected" : ""}`}
    >
      <span className="directory-location-icon">{glyph}</span>
      <span className="directory-location-name">{location.name}</span>
      {state === "current" ? <small>Hiện tại</small> : null}
      {state === "locked" ? <small>Khóa</small> : null}
    </Link>
  );
}

function TravelStatus({
  travels
}: {
  travels: Array<{ id: string; endsAt: Date; route: { origin: { name: string }; destination: { name: string } } }>;
}) {
  return (
    <div className="travel-status">
      <h2>Đang di chuyển</h2>
      {travels.map((travel) => (
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
  );
}

function LocationDetail({
  currentLocationId,
  location,
  route,
  realmName,
  isLocked,
  activityLocked
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
  route?: { id: string; travelMinutes: number; travelCost: bigint; dangerLevel: number; ambushAllowed: boolean; minimumRealmOrder: number } | null;
  realmName: string;
  isLocked: boolean;
  activityLocked: boolean;
}) {
  const isCurrent = location.id === currentLocationId;
  return (
    <div>
      <p className="text-xs font-bold uppercase text-jade">Chi tiết địa điểm</p>
      <h2>{location.name}</h2>
      <p className="muted mt-2">{location.description}</p>
      <div className="info-table mt-4">
        <div><span>Khu vực</span><b>{location.zone.name}</b></div>
        <div><span>Loại</span><b>{formatLocationKind(location.kind)}</b></div>
        <div><span>Nguy hiểm</span><b>{route ? `Cấp ${route.dangerLevel}` : `Khu vực ${location.zone.dangerLevel}`}</b></div>
        <div><span>Thời gian</span><b>{isCurrent ? "Đang ở đây" : route ? `${route.travelMinutes} phút` : "Không có tuyến trực tiếp"}</b></div>
        <div><span>Cảnh giới đề nghị</span><b>{realmName}</b></div>
        <div><span>An ninh</span><b>{formatSecurity(location.securityLevel)}</b></div>
        <div><span>Dịch vụ</span><b>{location.services.map(formatService).join(" · ") || "Chưa rõ"}</b></div>
      </div>

      {isCurrent ? (
        <Link href="/game/location" className="btn mt-4 w-full">Vào địa điểm</Link>
      ) : route && !isLocked && !activityLocked ? (
        <form action={startTravelAction} className="mt-4">
          <input type="hidden" name="routeId" value={route.id} />
          <button className="btn w-full">Đi tới</button>
          <p className="muted mt-2 text-sm">Chi phí {route.travelCost.toString()} linh thạch{route.ambushAllowed ? " · có thể gặp biến cố trên đường" : ""}.</p>
        </form>
      ) : (
        <button className="btn mt-4 w-full" disabled>{activityLocked ? "Đang có hoạt động" : route ? "Chưa đủ điều kiện" : "Không có tuyến trực tiếp"}</button>
      )}
    </div>
  );
}
