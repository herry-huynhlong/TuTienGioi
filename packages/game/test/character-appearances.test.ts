import { describe, expect, it } from "vitest";
import { characterAppearances, deterministicCharacterAppearanceKey, getCharacterAppearance, isValidCharacterAppearanceKey, resolveCharacterVisual } from "../src/character-appearances.js";

describe("character appearance manifest", () => {
  it("defines exactly ten default player appearances", () => {
    expect(characterAppearances).toHaveLength(10);
    expect(characterAppearances.filter((item) => item.genderPresentation === "MALE")).toHaveLength(5);
    expect(characterAppearances.filter((item) => item.genderPresentation === "FEMALE")).toHaveLength(5);
  });

  it("accepts only manifest keys", () => {
    expect(isValidCharacterAppearanceKey("male-03")).toBe(true);
    expect(isValidCharacterAppearanceKey("https://tracker.example/avatar.png")).toBe(false);
    expect(isValidCharacterAppearanceKey("../../npc/ta-thanh-huyen")).toBe(false);
    expect(isValidCharacterAppearanceKey("<script>")).toBe(false);
  });

  it("resolves appearance before legacy avatar and keeps legacy fallback", () => {
    const resolved = resolveCharacterVisual({ id: "char-a", name: "A", appearanceKey: "female-02", avatar: "/legacy/head.png" });
    expect(resolved.image).toBe("/characters/default/female-02.webp");
    expect(resolved.avatar).toBe("/characters/default/female-02.webp");
    expect(resolved.legacyAvatar).toBe("/legacy/head.png");

    const legacy = resolveCharacterVisual({ id: null, name: "B", appearanceKey: "bad-key", avatar: "/legacy/head.png" });
    expect(legacy.image).toBeNull();
    expect(legacy.avatar).toBe("/legacy/head.png");
  });

  it("uses deterministic fallback for old characters without appearance", () => {
    const key = deterministicCharacterAppearanceKey("old-character-id");
    expect(getCharacterAppearance(key)).not.toBeNull();
    expect(deterministicCharacterAppearanceKey("old-character-id")).toBe(key);
  });
});
