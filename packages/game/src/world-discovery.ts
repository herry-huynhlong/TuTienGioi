import { Prisma, type PrismaClient } from "@ttg/db";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

type DiscoveryLocation = {
  id: string;
  routesFrom: Array<{ destinationId: string; active: boolean }>;
  routesTo?: Array<{ originId: string; active: boolean }>;
};

export const defaultKnownLocationKeys = [
  "thanh-van-dong-thanh",
  "cho-linh-bao",
  "bac-mon",
  "thanh-truc-lam",
  "linh-khe",
  "thanh-van-son",
  "thanh-linh-son-mon"
] as const;

export type LocationDiscoveryResult = {
  alreadyKnownIds: Set<string>;
  discoveredIds: Set<string>;
  newlyDiscovered: Array<{ id: string; name: string }>;
};

export async function ensureLocationDiscovery(db: Db, characterId: string, locationId: string, source = "known") {
  return db.playerLocationDiscovery.upsert({
    where: { characterId_locationId: { characterId, locationId } },
    update: {},
    create: { characterId, locationId, source }
  });
}

export async function revealAdjacentLocations(db: Db, characterId: string, currentLocationId: string | null): Promise<LocationDiscoveryResult> {
  const existing = await db.playerLocationDiscovery.findMany({
    where: { characterId },
    select: { locationId: true }
  });
  const alreadyKnownIds = new Set(existing.map((row) => row.locationId));
  const discoveredIds = new Set(alreadyKnownIds);
  const targetIds = new Set<string>();

  if (currentLocationId) {
    targetIds.add(currentLocationId);
    const current = await db.location.findUnique({
      where: { id: currentLocationId },
      include: {
        routesFrom: { where: { active: true }, select: { destinationId: true, active: true } },
        routesTo: { where: { active: true }, select: { originId: true, active: true } }
      }
    });
    if (current) {
      for (const route of current.routesFrom) targetIds.add(route.destinationId);
      for (const route of current.routesTo ?? []) targetIds.add(route.originId);
    }
  }

  const defaults = await db.location.findMany({
    where: { key: { in: [...defaultKnownLocationKeys] } },
    select: { id: true }
  });
  for (const location of defaults) targetIds.add(location.id);

  const newIds = [...targetIds].filter((id) => !alreadyKnownIds.has(id));
  if (newIds.length === 0) return { alreadyKnownIds, discoveredIds, newlyDiscovered: [] };

  await db.playerLocationDiscovery.createMany({
    data: newIds.map((locationId) => ({
      characterId,
      locationId,
      source: locationId === currentLocationId ? "current" : "adjacent"
    })),
    skipDuplicates: true
  });
  for (const id of newIds) discoveredIds.add(id);

  const newlyDiscovered = await db.location.findMany({
    where: { id: { in: newIds }, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return { alreadyKnownIds, discoveredIds, newlyDiscovered };
}

export function adjacentLocationIds(location: DiscoveryLocation | null | undefined) {
  const ids = new Set<string>();
  if (!location) return ids;
  for (const route of location.routesFrom) if (route.active) ids.add(route.destinationId);
  for (const route of location.routesTo ?? []) if (route.active) ids.add(route.originId);
  return ids;
}
