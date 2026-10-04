import type { ProfessionRank } from "@ttg/db";

export type ProfessionFacilityGrade = "LOW" | "MID" | "HIGH";

type FacilityEntry = {
  name: string;
  gradeLabel: string;
};

export const professionFacilityNames: Record<string, Record<ProfessionFacilityGrade, FacilityEntry>> = {
  ALCHEMY_FURNACE: {
    LOW: { name: "Thanh Đồng Đan Lô", gradeLabel: "Hạ Phẩm" },
    MID: { name: "Huyền Hỏa Đan Lô", gradeLabel: "Trung Phẩm" },
    HIGH: { name: "Cửu Chuyển Đan Lô", gradeLabel: "Thượng Phẩm" }
  },
  FORGE: {
    LOW: { name: "Huyền Thiết Đoán Lô", gradeLabel: "Hạ Phẩm" },
    MID: { name: "Địa Hỏa Đoán Đài", gradeLabel: "Trung Phẩm" },
    HIGH: { name: "Thiên Công Thần Lô", gradeLabel: "Thượng Phẩm" }
  },
  TALISMAN_TABLE: {
    LOW: { name: "Thanh Mộc Phù Án", gradeLabel: "Hạ Phẩm" },
    MID: { name: "Linh Văn Phù Đài", gradeLabel: "Trung Phẩm" },
    HIGH: { name: "Thiên Cơ Phù Điện", gradeLabel: "Thượng Phẩm" }
  },
  FORMATION_ALTAR: {
    LOW: { name: "Tụ Linh Trận Bàn", gradeLabel: "Hạ Phẩm" },
    MID: { name: "Huyền Cơ Trận Đài", gradeLabel: "Trung Phẩm" },
    HIGH: { name: "Cửu Cung Trận Điện", gradeLabel: "Thượng Phẩm" }
  }
};

export const professionFacilityRoleLabels: Record<string, string> = {
  alchemy: "Cần: Đan Lô",
  forging: "Cần: Đoán Lô / Đoán Đài",
  talisman: "Cần: Phù Án / Phù Đài",
  formation: "Cần: Trận Bàn / Trận Đài"
};

export function facilityGradeForRank(rank: ProfessionRank | string): ProfessionFacilityGrade {
  if (rank === "MASTER" || rank === "GRANDMASTER") return "HIGH";
  if (rank === "ADEPT" || rank === "EXPERT") return "MID";
  return "LOW";
}

export function professionFacilityFor(station: string, rank: ProfessionRank | string) {
  const grade = facilityGradeForRank(rank);
  return professionFacilityNames[station]?.[grade] ?? { name: station, gradeLabel: grade };
}
