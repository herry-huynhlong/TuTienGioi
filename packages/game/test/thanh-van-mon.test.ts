import { describe, expect, it } from "vitest";
import { SectRoleName } from "@ttg/db";
import { canAccessThanhVanLocationByState, innerRequirementForRootQuality, roleToThanhVanState, thanhVanLocationAccess } from "../src/sect-access.js";
import { revealThanhVanSpiritualRoot, thanhVanRoleLabel } from "../src/thanh-van-mon.js";

describe("Thanh Van Mon runtime rules", () => {
  it("maps sect roles to gameplay membership states", () => {
    expect(roleToThanhVanState(undefined)).toBe("OUTSIDER");
    expect(roleToThanhVanState(SectRoleName.OUTER)).toBe("OUTER_DISCIPLE");
    expect(roleToThanhVanState(SectRoleName.INNER)).toBe("INNER_DISCIPLE");
    expect(roleToThanhVanState(SectRoleName.ELDER)).toBe("INNER_DISCIPLE");
    expect(roleToThanhVanState(SectRoleName.TRUE_DISCIPLE)).toBe("TRUE_DISCIPLE");
    expect(roleToThanhVanState(SectRoleName.LEADER)).toBe("TRUE_DISCIPLE");
  });

  it("gates Thanh Van locations by disciple state", () => {
    expect(thanhVanLocationAccess["thanh-van-noi-mon"]).toBe("INNER_DISCIPLE");
    expect(canAccessThanhVanLocationByState("OUTSIDER", "thanh-van-son-mon").allowed).toBe(true);
    expect(canAccessThanhVanLocationByState("APPLICANT", "thanh-van-giam-linh-dai").allowed).toBe(true);
    expect(canAccessThanhVanLocationByState("APPLICANT", "thanh-van-ngoai-mon").allowed).toBe(true);
    expect(canAccessThanhVanLocationByState("OUTER_DISCIPLE", "thanh-van-noi-mon").allowed).toBe(false);
    expect(canAccessThanhVanLocationByState("INNER_DISCIPLE", "thanh-van-noi-mon").allowed).toBe(true);
    expect(canAccessThanhVanLocationByState("INNER_DISCIPLE", "thanh-van-dai-dien").allowed).toBe(false);
  });

  it("scales inner disciple requirements by spiritual root quality", () => {
    expect(innerRequirementForRootQuality("Cực").contribution).toBe(120);
    expect(innerRequirementForRootQuality("Thượng").stageOrder).toBe(5);
    expect(innerRequirementForRootQuality("Trung").contribution).toBe(240);
    expect(innerRequirementForRootQuality("Phàm").label).toContain("Luyện Khí tầng 8");
  });

  it("keeps Vietnamese labels stable for UI", () => {
    expect(thanhVanRoleLabel("OUTER_DISCIPLE")).toBe("Ngoại Môn Đệ Tử");
    expect(thanhVanRoleLabel("INNER_DISCIPLE")).toBe("Nội Môn Đệ Tử");
    expect(thanhVanRoleLabel("TRUE_DISCIPLE")).toBe("Chân Truyền Đệ Tử");
  });

  it("reveals spiritual root idempotently without repeating NPC relationship rewards", async () => {
    let existingReveal: null | { id: string } = null;
    let npcRelationshipIncrements = 0;
    let spiritualRootUpserts = 0;
    const tx = {
      character: {
        findUniqueOrThrow: async () => ({
          id: "char_1",
          spiritualRoot: { name: "Thủy Linh Căn", quality: "Trung", elements: ["Thủy"], multiplierBps: 11000 }
        })
      },
      characterQuestFlag: {
        findUnique: async () => existingReveal,
        upsert: async ({ where }: { where: { characterId_key: { key: string } } }) => {
          if (where.characterId_key.key === "thanh_van_spiritual_root_revealed") {
            spiritualRootUpserts += 1;
            existingReveal = { id: "flag_1" };
          }
          return existingReveal ?? { id: where.characterId_key.key };
        }
      },
      npc: {
        findUnique: async () => ({ id: "npc_1" })
      },
      playerNpcState: {
        upsert: async ({ update }: { update: { relationshipScore: { increment: number } } }) => {
          npcRelationshipIncrements += update.relationshipScore.increment;
          return { id: "npc_state_1" };
        }
      },
      characterQuest: {
        updateMany: async () => ({ count: 1 })
      }
    };
    const db = { $transaction: async <T>(callback: (inner: typeof tx) => Promise<T>) => callback(tx) };

    const first = await revealThanhVanSpiritualRoot(db as never, "char_1");
    const second = await revealThanhVanSpiritualRoot(db as never, "char_1");

    expect(first.alreadyRevealed).toBe(false);
    expect(second.alreadyRevealed).toBe(true);
    expect(spiritualRootUpserts).toBe(1);
    expect(npcRelationshipIncrements).toBe(5);
  });
});
