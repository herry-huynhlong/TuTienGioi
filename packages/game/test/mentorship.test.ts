import { describe, expect, it } from "vitest";
import { SectRoleName } from "@ttg/db";
import { calculateMentorInterest, mentorConfigs, trueDiscipleRequirementForRootQuality } from "../src/mentorship.js";
import { hasSectPermission, sectRoles } from "../src/sects.js";

const baseCandidate = {
  membershipState: "INNER_DISCIPLE" as const,
  spiritualRootQuality: "Trung Phẩm",
  spiritualRootName: "Mộc Linh Căn",
  spiritualRootElements: ["Mộc"],
  realmOrder: 1,
  stageOrder: 2,
  contribution: 3500,
  completedSectMissionKeys: ["diet-xich-nhan-lang"],
  completedCraftProfessionKeys: [] as string[],
  worldObjectKeys: [] as string[],
  learnedTechniqueCount: 1,
  trainingCompletedCount: 1,
  karma: 0
};

describe("Thanh Van mentorship rules", () => {
  it("keeps outer disciples out of automatic invitations", () => {
    const ta = mentorConfigs.find((mentor) => mentor.key === "ta-thanh-huyen")!;
    const interest = calculateMentorInterest(ta, { ...baseCandidate, membershipState: "OUTER_DISCIPLE" });
    expect(interest.level).not.toBe("INVITE_READY");
  });

  it("uses root quality as a modifier, not a hard lock", () => {
    const mac = mentorConfigs.find((mentor) => mentor.key === "mac-van-son")!;
    const interest = calculateMentorInterest(mac, {
      ...baseCandidate,
      spiritualRootQuality: "Tạp Linh Căn",
      spiritualRootName: "Tạp Linh Căn",
      spiritualRootElements: ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ"],
      realmOrder: 1,
      stageOrder: 3,
      contribution: 4000
    });
    expect(interest.level).toBe("INVITE_READY");
  });

  it("scales true disciple requirements by root quality", () => {
    expect(trueDiscipleRequirementForRootQuality("Tạp Linh Căn")).toMatchObject({ realmOrder: 1, stageOrder: 3, contribution: 4000 });
    expect(trueDiscipleRequirementForRootQuality("Trung Phẩm")).toMatchObject({ realmOrder: 1, stageOrder: 2, contribution: 3500 });
    expect(trueDiscipleRequirementForRootQuality("Thượng Phẩm")).toMatchObject({ realmOrder: 1, stageOrder: 1, contribution: 3000 });
    expect(trueDiscipleRequirementForRootQuality("Biến Dị Lôi Linh Căn")).toMatchObject({ realmOrder: 1, stageOrder: 0, contribution: 2500 });
  });

  it("does not grant management permissions to true disciples", () => {
    expect(sectRoles[SectRoleName.TRUE_DISCIPLE].label).toBe("Chân Truyền Đệ Tử");
    expect(hasSectPermission(SectRoleName.TRUE_DISCIPLE, "VIEW_ADMIN")).toBe(false);
    expect(hasSectPermission(SectRoleName.TRUE_DISCIPLE, "MANAGE_STORAGE")).toBe(false);
  });
});
