import { describe, expect, it } from "vitest";
import { getOnboardingState, recordOnboardingEvent } from "../src/onboarding.js";

function fakeOnboardingDb() {
  let exists = false;
  let row = {
    key: "main",
    status: "ACTIVE",
    completedObjectives: [] as string[],
    rewardClaimed: false
  };
  return {
    row,
    db: {
      onboardingProgress: {
        upsert: async ({ create }: { create: typeof row }) => {
          if (!exists) {
            row = { ...row, ...create };
            exists = true;
          }
          return row;
        },
        update: async ({ data }: { data: Partial<typeof row> }) => {
          row = { ...row, ...data };
          return row;
        }
      }
    }
  };
}

describe("onboarding progress", () => {
  it("creates the expected first chapter for a new player", async () => {
    const fake = fakeOnboardingDb();

    const state = await getOnboardingState(fake.db as never, "char_1");

    expect(state.status).toBe("ACTIVE");
    expect(state.currentChapter.key).toBe("nhap-the");
    expect(state.nextObjective.key).toBe("view-character");
    expect(state.completedCount).toBe(0);
  });

  it("advances from server-side events without trusting client completion flags", async () => {
    const fake = fakeOnboardingDb();

    await recordOnboardingEvent(fake.db as never, "char_1", "VIEW_CHARACTER");
    await recordOnboardingEvent(fake.db as never, "char_1", "CULTIVATION_STARTED");
    const state = await getOnboardingState(fake.db as never, "char_1");

    expect(state.completedCount).toBe(2);
    expect(state.currentChapter.key).toBe("dan-khi-nhap-the");
    expect(state.currentChapter.objectives.find((objective) => objective.key === "start-cultivation")?.completed).toBe(true);
    expect(state.currentChapter.objectives.find((objective) => objective.key === "claim-cultivation")?.completed).toBe(false);
  });

  it("does not duplicate progress when the same event is recorded twice", async () => {
    const fake = fakeOnboardingDb();

    await recordOnboardingEvent(fake.db as never, "char_1", "VIEW_CHARACTER");
    await recordOnboardingEvent(fake.db as never, "char_1", "VIEW_CHARACTER");
    const state = await getOnboardingState(fake.db as never, "char_1");

    expect(state.completedCount).toBe(1);
  });
});
