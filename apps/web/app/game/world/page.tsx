import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimTravelAction, startTravelAction } from "@/lib/forms";
import { formatLocationKind, formatSecurity, formatService } from "@/lib/format";
import { getFeatureUnlockState, recordOnboardingEvent, travelDurationSeconds } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import {
  Anchor,
  Castle,
  CircleDot,
  Compass,
  DoorOpen,
  Gem,
  HelpCircle,
  Home,
  Landmark,
  Leaf,
  Lock,
  MapPin,
  Mountain,
  Pickaxe,
  Route,
  ScrollText,
  Shield,
  ShoppingBag,
  Swords,
  Trees,
  Waves,
  type LucideIcon
} from "lucide-react";

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

const locationIcons: Record<string, LucideIcon> = {
  district: Home,
  market: ShoppingBag,
  gate: DoorOpen,
  road: Route,
  wilds: Compass,
  forest: Trees,
  mountain: Mountain,
  river: Waves,
  valley: Mountain,
  sect_land: Shield,
  harbor: Anchor,
  resource: Pickaxe,
  outpost: Castle,
  ruin: Landmark,
  city_hub: Landmark
};

const serviceIcons: Record<string, LucideIcon> = {
  market: ShoppingBag,
  auction: Gem,
  npc_shop: ShoppingBag,
  inn: Home,
  mail: ScrollText,
  travel: Route,
  caravan: Route,
  explore: Compass,
  pve: Swords,
  resource: Leaf,
  encounter: CircleDot,
  formation: Shield,
  secret: Landmark,
  forging: Pickaxe,
  contract: ScrollText,
  event: CircleDot
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
  const [worlds, featureUnlocks, itemTemplates, monsters] = await Promise.all([
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
    getFeatureUnlockState(prisma, c.id),
    prisma.itemTemplate.findMany({ select: { key: true, name: true } }),
    prisma.monster.findMany({ select: { key: true, name: true } })
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
  const itemNames = new Map(itemTemplates.map((item) => [item.key, item.name]));
  const monsterNames = new Map(monsters.map((monster) => [monster.key, monster.name]));

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
                  itemNames={itemNames}
                  monsterNames={monsterNames}
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
  location: { key: string; name: string; kind: string; services: string[] };
  selected: boolean;
  state: DiscoveryState;
}) {
  if (state === "unknown") {
    return (
      <div className="directory-location-row directory-location-unknown" title="Bạn chưa biết nơi này.">
        <span className="directory-location-icon"><HelpCircle size={15} aria-hidden /></span>
        <span className="directory-location-name">???</span>
      </div>
    );
  }

  const Icon = state === "locked" ? Lock : state === "current" ? MapPin : locationIcons[location.kind] ?? MapPin;
  return (
    <Link
      href={`/game/world?region=${activeRegionKey}&location=${location.key}`}
      className={`directory-location-row directory-location-${state} ${selected ? "selected" : ""}`}
    >
      <span className="directory-location-icon"><Icon size={15} aria-hidden /></span>
      <span className="directory-location-name">
        {location.name}
        <small>{formatLocationKind(location.kind)}{location.services.length ? ` · ${location.services.slice(0, 2).map(formatService).join(", ")}` : ""}</small>
      </span>
      {state === "current" ? <small className="directory-location-status">Hiện tại</small> : null}
      {state === "locked" ? <small className="directory-location-status">Khóa</small> : null}
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
  activityLocked,
  itemNames,
  monsterNames
}: {
  currentLocationId: string | null;
  location: {
    id: string;
    name: string;
    description: string;
    kind: string;
    securityLevel: string;
    services: string[];
    encounterTable: unknown;
    zone: { name: string; dangerLevel: number; description: string; resourceTable: unknown; monsterTable: unknown };
    routesFrom: Array<{ id: string; name: string; travelMinutes: number; travelCost: bigint; dangerLevel: number; destination: { name: string } }>;
  };
  route?: { id: string; travelMinutes: number; travelCost: bigint; dangerLevel: number; ambushAllowed: boolean; minimumRealmOrder: number } | null;
  realmName: string;
  isLocked: boolean;
  activityLocked: boolean;
  itemNames: Map<string, string>;
  monsterNames: Map<string, string>;
}) {
  const isCurrent = location.id === currentLocationId;
  const LocationIcon = locationIcons[location.kind] ?? MapPin;
  const resources = parseWeightedTable(location.zone.resourceTable).map((entry) => ({ ...entry, label: itemNames.get(entry.key) ?? entry.key }));
  const monsters = parseWeightedTable(location.zone.monsterTable).map((entry) => ({ ...entry, label: monsterNames.get(entry.key) ?? entry.key }));
  const encounters = parseWeightedTable(location.encounterTable);
  const opportunities = describeOpportunities(location.services, Boolean(route?.ambushAllowed));
  return (
    <div>
      <p className="text-xs font-bold uppercase text-jade">Chi tiết địa điểm</p>
      <div className="location-detail-heading">
        <span><LocationIcon size={22} aria-hidden /></span>
        <h2>{location.name}</h2>
      </div>
      <p className="muted mt-2">{location.description}</p>
      <div className="info-table mt-4">
        <div><span>Khu vực</span><b>{location.zone.name}</b></div>
        <div><span>Loại</span><b>{formatLocationKind(location.kind)}</b></div>
        <div><span>Nguy hiểm</span><b>{route ? `Cấp ${route.dangerLevel}` : `Khu vực ${location.zone.dangerLevel}`}</b></div>
        <div><span>Thời gian</span><b>{isCurrent ? "Đang ở đây" : route ? formatTravelDuration(route.travelMinutes) : "Không có tuyến trực tiếp"}</b></div>
        <div><span>Cảnh giới đề nghị</span><b>{realmName}</b></div>
        <div><span>An ninh</span><b>{formatSecurity(location.securityLevel)}</b></div>
        <div><span>Dịch vụ</span><b>{location.services.map(formatService).join(" · ") || "Chưa rõ"}</b></div>
      </div>

      <div className="world-detail-section">
        <h3>Ở đây có gì</h3>
        <div className="world-service-grid">
          {location.services.map((service) => {
            const Icon = serviceIcons[service] ?? CircleDot;
            return (
              <span key={service}>
                <Icon size={14} aria-hidden />
                {formatService(service)}
              </span>
            );
          })}
          {location.services.length === 0 ? <span><HelpCircle size={14} aria-hidden />Chưa có dịch vụ</span> : null}
        </div>
      </div>

      <div className="world-detail-section">
        <h3>Thiên tài địa bảo</h3>
        <WeightedList items={resources} empty="Chưa ghi nhận tài nguyên ổn định tại khu vực này." />
      </div>

      <div className="world-detail-section">
        <h3>Yêu thú / biến cố</h3>
        <WeightedList items={monsters.length ? monsters : encounters.map((entry) => ({ ...entry, label: formatEncounter(entry.key) }))} empty="Khu vực này tương đối yên ổn." />
      </div>

      <div className="world-detail-section">
        <h3>Gợi ý hoạt động</h3>
        <div className="world-hint-list">
          {opportunities.map((item) => <p key={item}>{item}</p>)}
        </div>
      </div>

      <div className="world-detail-section">
        <h3>Tuyến từ đây</h3>
        {location.routesFrom.length > 0 ? (
          <div className="world-route-list">
            {location.routesFrom.slice(0, 5).map((outgoing) => (
              <div key={outgoing.id}>
                <b>{outgoing.destination.name}</b>
                <small>{formatTravelDuration(outgoing.travelMinutes)} · {outgoing.travelCost.toString()} linh thạch · nguy hiểm {outgoing.dangerLevel}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">Chưa có tuyến xuất phát trực tiếp từ địa điểm này.</p>
        )}
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

function parseWeightedTable(value: unknown): Array<{ key: string; weight: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const key = "key" in entry ? entry.key : undefined;
    const weight = "weight" in entry ? entry.weight : undefined;
    if (typeof key !== "string") return [];
    return [{ key, weight: typeof weight === "number" ? weight : 0 }];
  });
}

function formatTravelDuration(travelMinutes: number) {
  return `${travelDurationSeconds(travelMinutes)} giây`;
}

function WeightedList({ items, empty }: { items: Array<{ key: string; label: string; weight: number }>; empty: string }) {
  if (items.length === 0) return <p className="muted text-sm">{empty}</p>;
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  return (
    <div className="world-chip-list">
      {items.slice(0, 6).map((item) => (
        <span key={item.key}>
          {item.label}
          {total > 0 ? <small>{Math.round((Math.max(0, item.weight) / total) * 100)}%</small> : null}
        </span>
      ))}
    </div>
  );
}

function describeOpportunities(services: string[], routeHasAmbush: boolean) {
  const hints: string[] = [];
  if (services.includes("travel")) hints.push("Có thể dùng làm điểm trung chuyển để mở tuyến đường mới.");
  if (services.includes("caravan")) hints.push("Có tiêu cục hoặc đoàn lữ hành, phù hợp chuẩn bị trước khi ra ngoại vực.");
  if (services.includes("market")) hints.push("Có giao dịch vật phẩm, nên kiểm tra chợ trước khi lịch luyện dài.");
  if (services.includes("explore")) hints.push("Có thể lịch luyện để nhận tài nguyên hoặc cơ duyên.");
  if (services.includes("pve")) hints.push("Có khả năng gặp yêu thú qua hoạt động thật, không khiêu chiến trực tiếp từ bản đồ.");
  if (services.includes("resource")) hints.push("Có thiên tài địa bảo trong bảng tài nguyên của khu vực.");
  if (services.includes("formation")) hints.push("Có dấu vết trận pháp, phù hợp các nội dung công pháp/trận pháp sau này.");
  if (routeHasAmbush) hints.push("Tuyến tới đây có thể phát sinh biến cố trên đường.");
  return hints.length ? hints : ["Địa điểm này chủ yếu dùng để định vị và mở đường đi tiếp."];
}

function formatEncounter(key: string) {
  return ({
    "safe-passage": "Đường bình an",
    "resource-cache": "Dấu tài nguyên",
    "wandering-monster": "Yêu thú lang thang",
    traveler: "Tu sĩ lữ hành",
    "rare-omen": "Điềm lạ"
  } as Record<string, string>)[key] ?? key;
}
