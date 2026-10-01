import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimTravelAction, startTravelAction } from "@/lib/forms";
import { formatLocationKind, formatSecurity, formatService } from "@/lib/game-display";
import { defaultKnownLocationKeys, getFeatureUnlockState, recordOnboardingEvent, revealAdjacentLocations, travelDurationSeconds } from "@ttg/game";
import Link from "next/link";
import { redirect } from "next/navigation";
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
type WorldMapLocation = {
  id: string;
  key: string;
  name: string;
  kind: string;
  services: string[];
  minimumRealmOrder: number;
  zone: { id: string; key: string; name: string };
  routesFrom: Array<{
    id: string;
    destinationId: string;
    travelMinutes: number;
    travelCost: bigint;
    dangerLevel: number;
    minimumRealmOrder: number;
    destination: { id: string; key: string; name: string };
  }>;
};
type MapNode = WorldMapLocation & {
  index: number;
  state: DiscoveryState;
  selected: boolean;
  visible: boolean;
  x: number;
  y: number;
  missionCount: number;
};
type RegionMapLayout = {
  backgroundImage?: string;
  positions?: Record<string, { mapX: number; mapY: number }>;
};

const publicKnownLocationKeys = new Set<string>(defaultKnownLocationKeys);

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

const locationIconGlyphs: Record<string, string> = {
  district: "⌂",
  market: "◇",
  gate: "⌁",
  road: "↝",
  wilds: "✦",
  forest: "♣",
  mountain: "△",
  river: "≈",
  valley: "▽",
  sect_land: "✧",
  sect_gate: "門",
  sect_outer: "外",
  sect_inner: "内",
  sect_hall: "殿",
  library: "書",
  alchemy_hall: "丹",
  forging_hall: "器",
  formation_hall: "陣",
  mission_hall: "令",
  spirit_testing: "靈",
  spirit_farm: "田",
  spirit_mine: "礦",
  training_ground: "武",
  cave_district: "洞",
  back_mountain: "山",
  harbor: "⚓",
  resource: "◆",
  outpost: "▣",
  ruin: "✶",
  city_hub: "◎"
};

const regionMapLayouts: Record<string, RegionMapLayout> = {
  "thanh-van-vuc": {
    backgroundImage: "/world-maps/xianxia-thanh-van-vuc.png",
    positions: {
      "thanh-van-dong-thanh": { mapX: 20, mapY: 34 },
      "cho-linh-bao": { mapX: 31, mapY: 39 },
      "bac-mon": { mapX: 41, mapY: 35 },
      "linh-khe": { mapX: 47, mapY: 61 },
      "thanh-truc-lam": { mapX: 34, mapY: 76 },
      "thanh-van-son": { mapX: 63, mapY: 56 },
      "thanh-linh-son-mon": { mapX: 78, mapY: 30 },
      "hac-phong-coc": { mapX: 86, mapY: 68 },
      "thanh-van-quan-dao": { mapX: 51, mapY: 43 },
      "hac-son-chan-nui": { mapX: 70, mapY: 71 },
      "thanh-van-son-mon": { mapX: 82, mapY: 24 },
      "thanh-van-ngoai-mon": { mapX: 75, mapY: 22 },
      "thanh-van-noi-mon": { mapX: 80, mapY: 17 },
      "thanh-van-dai-dien": { mapX: 86, mapY: 15 },
      "thanh-van-tang-kinh-cac": { mapX: 83, mapY: 20 },
      "thanh-van-dan-duong": { mapX: 73, mapY: 28 },
      "thanh-van-khi-duong": { mapX: 69, mapY: 31 },
      "thanh-van-tran-duong": { mapX: 77, mapY: 25 },
      "thanh-van-nhiem-vu-duong": { mapX: 71, mapY: 24 },
      "thanh-van-giam-linh-dai": { mapX: 79, mapY: 20 },
      "thanh-van-linh-dien": { mapX: 58, mapY: 46 },
      "thanh-van-linh-khoang": { mapX: 66, mapY: 64 },
      "thanh-van-dien-vo-truong": { mapX: 76, mapY: 33 },
      "thanh-van-dong-phu-khu": { mapX: 84, mapY: 27 },
      "thanh-van-hau-son": { mapX: 92, mapY: 52 }
    }
  }
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
  if (!user) redirect("/");
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      travels: { where: { status: "ACTIVE" }, include: { route: { include: { origin: true, destination: true } } }, orderBy: { endsAt: "desc" } },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      explorations: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      location: true,
      currentLocation: { include: { zone: { include: { region: true } } } },
      realmStage: { include: { realm: true } }
    }
  });
  const discovery = await revealAdjacentLocations(prisma, c.id, c.currentLocationId);
  const [worlds, featureUnlocks, itemTemplates, monsters, activeSectMissions] = await Promise.all([
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
                    routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } },
                    routesTo: { where: { active: true }, include: { origin: true }, orderBy: { dangerLevel: "asc" } }
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
    prisma.monster.findMany({ select: { key: true, name: true } }),
    prisma.sectMissionParticipant.findMany({
      where: { characterId: c.id, status: { in: ["ACTIVE", "READY_TO_TURN_IN"] } },
      include: { mission: true },
      orderBy: { startedAt: "desc" },
      take: 3
    })
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
    ...discovery.discoveredIds,
    ...(currentLocationId ? [currentLocationId] : []),
    ...zones.flatMap((zone) => zone.locations.filter((location) => publicKnownLocationKeys.has(location.key)).map((location) => location.id))
  ]);
  const relevantUnknownIds = new Set<string>([
    ...currentRoutes.map((route) => route.destinationId),
    ...(currentLocation?.routesTo?.map((route) => route.originId) ?? []),
    ...zones.flatMap((zone) => zone.locations.filter((location) => knownLocationIds.has(location.id)).flatMap((location) => location.routesFrom.map((route) => route.destinationId)))
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
  const sectMissionByLocation = new Map<string, typeof activeSectMissions>();
  for (const mission of activeSectMissions) {
    const locationId = mission.mission?.locationId;
    if (!locationId) continue;
    sectMissionByLocation.set(locationId, [...(sectMissionByLocation.get(locationId) ?? []), mission]);
  }
  const mapLayout = regionMapLayouts[activeRegion?.key ?? ""] ?? {};
  const mapNodes = buildMapNodes({
    locations: allLocations,
    zones,
    layout: mapLayout,
    currentLocationId,
    knownLocationIds,
    routeByDestinationId,
    relevantUnknownIds,
    currentRealmOrder,
    selectedLocationId: selectedLocation?.id ?? null,
    missionCounts: new Map([...sectMissionByLocation.entries()].map(([locationId, missions]) => [locationId, missions.length]))
  });

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
      <ActionAlert message={params?.error ?? discoveryMessage(discovery.newlyDiscovered, currentLocationId)} />

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
            <WorldMapCanvas
              activeRegionKey={activeRegion.key}
              activeRegionName={activeRegion.name}
              layout={mapLayout}
              nodes={mapNodes}
              knownLocationIds={knownLocationIds}
              currentRealmOrder={currentRealmOrder}
              currentLocationId={currentLocationId}
            />
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
              {activeSectMissions.length > 0 ? <SectMissionTracker missions={activeSectMissions} /> : null}
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
                  knownLocationIds={knownLocationIds}
                />
              ) : (
                <div className="empty-state"><b>Chưa chọn địa điểm.</b><p>Chọn một địa điểm đã biết trong danh sách để xem chi tiết.</p></div>
              )}
            </section>
          </aside>
        </section>
      ) : (
        <div className="panel mt-5 rounded-lg p-6 muted">Thiên đồ hiện chưa ghi nhận địa vực nào.</div>
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

function buildMapNodes({
  locations,
  zones,
  layout,
  currentLocationId,
  knownLocationIds,
  routeByDestinationId,
  relevantUnknownIds,
  currentRealmOrder,
  selectedLocationId,
  missionCounts
}: {
  locations: WorldMapLocation[];
  zones: Array<{ id: string; key: string; name: string }>;
  layout: RegionMapLayout;
  currentLocationId: string | null;
  knownLocationIds: Set<string>;
  routeByDestinationId: Map<string, { minimumRealmOrder: number }>;
  relevantUnknownIds: Set<string>;
  currentRealmOrder: number;
  selectedLocationId: string | null;
  missionCounts: Map<string, number>;
}): MapNode[] {
  const zoneIndex = new Map(zones.map((zone, index) => [zone.id, index]));
  const locationsByZone = new Map<string, WorldMapLocation[]>();
  for (const location of locations) {
    const list = locationsByZone.get(location.zone.id) ?? [];
    list.push(location);
    locationsByZone.set(location.zone.id, list);
  }
  for (const list of locationsByZone.values()) {
    list.sort((a, b) => (locationOrder[a.key] ?? 999) - (locationOrder[b.key] ?? 999) || a.name.localeCompare(b.name));
  }

  return locations.map((location) => {
    const state = getLocationState(location, currentLocationId, knownLocationIds, routeByDestinationId, currentRealmOrder);
    const visible = state !== "unknown" || relevantUnknownIds.has(location.id);
    const configuredPosition = layout.positions?.[location.key];
    const zoneOrder = zoneIndex.get(location.zone.id) ?? 0;
    const zoneLocations = locationsByZone.get(location.zone.id) ?? [];
    const localIndex = Math.max(0, zoneLocations.findIndex((entry) => entry.id === location.id));
    const rowCount = Math.max(1, zones.length);
    const rowHeight = 72 / rowCount;
    const yBase = 16 + rowHeight * zoneOrder;
    const localSpread = zoneLocations.length <= 1 ? 0.5 : localIndex / (zoneLocations.length - 1);
    const wave = Math.sin((localIndex + zoneOrder) * 1.6) * 5;
    const x = configuredPosition?.mapX ?? Math.max(7, Math.min(93, 10 + localSpread * 78 + (zoneOrder % 2) * 5));
    const y = configuredPosition?.mapY ?? Math.max(9, Math.min(91, yBase + rowHeight * 0.42 + wave));
    return {
      ...location,
      index: localIndex + 1,
      state,
      selected: selectedLocationId === location.id,
      visible,
      x,
      y,
      missionCount: missionCounts.get(location.id) ?? 0
    };
  });
}

function WorldMapCanvas({
  activeRegionKey,
  activeRegionName,
  layout,
  nodes,
  knownLocationIds,
  currentRealmOrder,
  currentLocationId
}: {
  activeRegionKey: string;
  activeRegionName: string;
  layout: RegionMapLayout;
  nodes: MapNode[];
  knownLocationIds: Set<string>;
  currentRealmOrder: number;
  currentLocationId: string | null;
}) {
  const visibleNodes = nodes.filter((node) => node.visible);
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  const routes = visibleNodes.flatMap((origin) => origin.routesFrom.flatMap((route) => {
    const destination = nodeById.get(route.destinationId);
    if (!destination) return [];
    const destinationKnown = knownLocationIds.has(destination.id);
    const originKnown = knownLocationIds.has(origin.id);
    if (!originKnown && !destinationKnown) return [];
    const routeState = origin.id === currentLocationId && destination.state !== "locked" && route.minimumRealmOrder <= currentRealmOrder
      ? "direct"
      : destinationKnown ? "known" : "mystery";
    const selected = origin.selected || destination.selected;
    return [{ route, origin, destination, destinationKnown, routeState, selected }];
  }));
  const backgroundStyle = layout.backgroundImage ? { backgroundImage: `url(${layout.backgroundImage})` } : undefined;
  return (
    <div className="world-map-shell">
      <div className="world-map-title">
        <div>
          <span>Bản đồ địa vực</span>
          <b>{activeRegionName}</b>
        </div>
        <small>{visibleNodes.length} điểm đã ghi nhận</small>
      </div>
      <div className="world-map-viewport">
        <div className="world-map-canvas" role="img" aria-label={`Bản đồ ${activeRegionName}`}>
          <div className="world-map-art" style={backgroundStyle} />
          <div className="world-map-bg" />
          <svg className="world-route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="worldRouteKnown" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(40, 221, 202, 0.25)" />
                <stop offset="50%" stopColor="rgba(104, 255, 236, 0.9)" />
                <stop offset="100%" stopColor="rgba(220, 190, 91, 0.45)" />
              </linearGradient>
            </defs>
            {routes.map(({ route, origin, destination, routeState, selected }) => {
              const path = routePath(origin, destination);
              return (
                <path
                  key={route.id}
                  d={path}
                  className={`world-route-path ${routeState} ${selected ? "selected" : ""}`}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          {visibleNodes.map((node) => (
            <MapMarker key={node.id} node={node} activeRegionKey={activeRegionKey} />
          ))}
        </div>
      </div>
      <div className="world-map-legend">
        <span><i className="legend-dot current" /> Hiện tại</span>
        <span><i className="legend-dot reachable" /> Đi được</span>
        <span><i className="legend-dot known" /> Đã biết</span>
        <span><i className="legend-dot unknown" /> Chưa khám phá</span>
      </div>
    </div>
  );
}

function routePath(origin: { x: number; y: number }, destination: { x: number; y: number }) {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const curve = Math.max(-10, Math.min(10, dx * 0.12 + dy * 0.18));
  const cx = (origin.x + destination.x) / 2 + curve;
  const cy = (origin.y + destination.y) / 2 - curve;
  return `M ${origin.x.toFixed(2)} ${origin.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${destination.x.toFixed(2)} ${destination.y.toFixed(2)}`;
}

function MapMarker({ node, activeRegionKey }: { node: MapNode; activeRegionKey: string }) {
  const known = node.state !== "unknown";
  const glyph = known ? locationIconGlyphs[node.kind] ?? String(node.index) : "?";
  const className = `world-map-marker ${node.state} ${node.selected ? "selected" : ""}`;
  const style = { left: `${node.x}%`, top: `${node.y}%` };
  const label = known ? node.name : "???";
  const meta = known
    ? `${formatLocationKind(node.kind)}${node.services.length ? ` · ${node.services.slice(0, 2).map(formatService).join(", ")}` : ""}`
    : "Chưa khám phá";
  const content = (
    <>
      <span className="marker-pin"><b>{glyph}</b></span>
      <span className="marker-label">
        <b>{label}</b>
        <small>{node.state === "current" ? "Hiện tại" : node.state === "reachable" ? "Có thể đi tới" : meta}</small>
      </span>
      {node.missionCount > 0 && known ? <em>{node.missionCount}</em> : null}
    </>
  );
  if (!known) {
    return <div className={className} style={style} title="Bạn chưa biết nơi này.">{content}</div>;
  }
  return (
    <Link href={`/game/world?region=${activeRegionKey}&location=${node.key}`} className={className} style={style}>
      {content}
    </Link>
  );
}

function SectMissionTracker({ missions }: { missions: Array<{ id: string; progress: number; targetCount: number; status: string; mission: { title: string; locationId: string | null; objective: unknown } | null }> }) {
  return (
    <div className="panel mb-4 rounded-lg p-4">
      <p className="text-xs font-bold uppercase text-jade">Nhiệm vụ Tông Môn</p>
      <div className="mt-2 grid gap-2">
        {missions.map((entry) => {
          const objective = entry.mission?.objective && typeof entry.mission.objective === "object" && !Array.isArray(entry.mission.objective) ? entry.mission.objective as Record<string, unknown> : {};
          return (
            <div key={entry.id} className="route-card">
              <div>
                <b>{entry.mission?.title ?? "Nhiệm vụ"}</b>
                <small>{objective.locationName as string || "Theo địa đồ"} · {entry.progress}/{entry.targetCount}</small>
              </div>
              <span className="text-xs font-bold text-gold">{entry.status === "READY_TO_TURN_IN" ? "Có thể nộp" : "Đang làm"}</span>
            </div>
          );
        })}
      </div>
    </div>
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
  monsterNames,
  knownLocationIds
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
    routesFrom: Array<{ id: string; name: string; destinationId: string; travelMinutes: number; travelCost: bigint; dangerLevel: number; destination: { name: string } }>;
  };
  route?: { id: string; travelMinutes: number; travelCost: bigint; dangerLevel: number; ambushAllowed: boolean; minimumRealmOrder: number } | null;
  realmName: string;
  isLocked: boolean;
  activityLocked: boolean;
  itemNames: Map<string, string>;
  monsterNames: Map<string, string>;
  knownLocationIds: Set<string>;
}) {
  const isCurrent = location.id === currentLocationId;
  const LocationIcon = locationIcons[location.kind] ?? MapPin;
  const resources = parseWeightedTable(location.zone.resourceTable).map((entry) => ({ ...entry, label: itemNames.get(entry.key) ?? "Tài nguyên chưa định danh" }));
  const monsters = parseWeightedTable(location.zone.monsterTable).map((entry) => ({ ...entry, label: monsterNames.get(entry.key) ?? "Dấu yêu khí lạ" }));
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
                <b>{knownLocationIds.has(outgoing.destinationId) ? outgoing.destination.name : "???"}</b>
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
  } as Record<string, string>)[key] ?? "Điềm lạ";
}

function discoveryMessage(newlyDiscovered: Array<{ id: string; name: string }>, currentLocationId: string | null) {
  const names = newlyDiscovered.filter((location) => location.id !== currentLocationId).map((location) => location.name);
  if (names.length === 0) return undefined;
  return `Bạn đã phát hiện ${names.length === 1 ? "một địa điểm mới" : "những địa điểm mới"}: ${names.join(", ")}.`;
}
