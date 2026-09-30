import { describe, expect, it } from "vitest";
import { npcDialogueState, npcRelationshipState, npcWorldDialoguePreview } from "../src/quests.js";

describe("npc state helpers", () => {
  it("maps relationship score into stable labels", () => {
    expect(npcRelationshipState(0)).toBe("Xa lạ");
    expect(npcRelationshipState(10)).toBe("Quen biết");
    expect(npcRelationshipState(30)).toBe("Thiện cảm");
    expect(npcRelationshipState(60)).toBe("Thân hữu");
  });

  it("chooses contextual dialogue state by player/npc history and quest status", () => {
    const base = {
      previouslyMet: false,
      movedSinceLastMeeting: false,
      helped: false,
      relationshipScore: 0,
      activeQuestCount: 0,
      readyQuestCount: 0,
      availableQuestCount: 1
    };

    expect(npcDialogueState(base)).toBe("first");
    expect(npcDialogueState({ ...base, previouslyMet: true })).toBe("repeat");
    expect(npcDialogueState({ ...base, previouslyMet: true, movedSinceLastMeeting: true })).toBe("moved");
    expect(npcDialogueState({ ...base, previouslyMet: true, helped: true })).toBe("helped");
    expect(npcDialogueState({ ...base, previouslyMet: true, relationshipScore: 30 })).toBe("friendly");
    expect(npcDialogueState({ ...base, previouslyMet: true, activeQuestCount: 1 })).toBe("activeQuest");
    expect(npcDialogueState({ ...base, previouslyMet: true, readyQuestCount: 1 })).toBe("readyQuest");
  });

  it("exposes world dialogue actions without generic technical labels", () => {
    const merchant = npcWorldDialoguePreview("van-bao-lau-quan-su");
    expect(merchant.choices.find((choice) => choice.label === "Xem hàng hóa")).toMatchObject({
      action: "OPEN_SHOP",
      payload: { route: "/game/market" }
    });
    expect(merchant.choices.some((choice) => choice.label === "Hỏi về nơi này")).toBe(false);

    const wounded = npcWorldDialoguePreview("tu-si-bi-thuong");
    expect(wounded.nodes.help?.choices.find((choice) => choice.label === "Nhận lời")).toMatchObject({
      action: "ACCEPT_QUEST",
      payload: { questKey: "san-yeu-dau-tien" }
    });

    const elder = npcWorldDialoguePreview("truyen-cong-truong-lao");
    expect(elder.choices.find((choice) => choice.label === "Xem công pháp đang có")).toMatchObject({
      action: "OPEN_INVENTORY",
      payload: { route: "/game/inventory?filter=MANUAL" }
    });
  });
});
