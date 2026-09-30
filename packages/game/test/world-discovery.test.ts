import { describe, expect, it } from "vitest";
import { revealAdjacentLocations } from "../src/world-discovery.js";

function fakeWorldDb() {
  const discoveries: Array<{ characterId: string; locationId: string; source: string }> = [];
  const locations = [
    { id: "loc_a", key: "a", name: "Đông Thành", active: true, routesFrom: [{ destinationId: "loc_b", active: true }], routesTo: [] },
    { id: "loc_b", key: "b", name: "Rừng Trúc", active: true, routesFrom: [], routesTo: [{ originId: "loc_a", active: true }] },
    { id: "loc_c", key: "c", name: "Sơn Cốc Xa", active: true, routesFrom: [], routesTo: [] }
  ];
  return {
    discoveries,
    db: {
      playerLocationDiscovery: {
        findMany: async ({ where }: { where: { characterId: string } }) => discoveries.filter((row) => row.characterId === where.characterId).map((row) => ({ locationId: row.locationId })),
        createMany: async ({ data, skipDuplicates }: { data: typeof discoveries; skipDuplicates: boolean }) => {
          for (const row of data) {
            if (skipDuplicates && discoveries.some((entry) => entry.characterId === row.characterId && entry.locationId === row.locationId)) continue;
            discoveries.push(row);
          }
          return { count: data.length };
        }
      },
      location: {
        findUnique: async ({ where }: { where: { id: string } }) => locations.find((location) => location.id === where.id) ?? null,
        findMany: async ({ where }: { where: { id?: { in: string[] }; key?: { in: readonly string[] }; active?: boolean } }) => locations.filter((location) => {
          if (where.id?.in && !where.id.in.includes(location.id)) return false;
          if (where.key?.in && !where.key.in.includes(location.key)) return false;
          if (where.active !== undefined && location.active !== where.active) return false;
          return true;
        }).map(({ id, name }) => ({ id, name }))
      }
    }
  };
}

describe("world location discovery", () => {
  it("reveals only the current location and adjacent connections", async () => {
    const fake = fakeWorldDb();

    const result = await revealAdjacentLocations(fake.db as never, "char_1", "loc_a");

    expect(result.discoveredIds.has("loc_a")).toBe(true);
    expect(result.discoveredIds.has("loc_b")).toBe(true);
    expect(result.discoveredIds.has("loc_c")).toBe(false);
    expect(result.newlyDiscovered.map((location) => location.name)).toEqual(["Đông Thành", "Rừng Trúc"]);
  });

  it("keeps discoveries stable after reload", async () => {
    const fake = fakeWorldDb();

    await revealAdjacentLocations(fake.db as never, "char_1", "loc_a");
    const result = await revealAdjacentLocations(fake.db as never, "char_1", "loc_a");

    expect(result.newlyDiscovered).toEqual([]);
    expect(result.discoveredIds.has("loc_b")).toBe(true);
  });
});
