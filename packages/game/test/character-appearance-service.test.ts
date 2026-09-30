import { describe, expect, it, vi } from "vitest";
import { CharacterAppearanceError, setCharacterAppearance } from "../src/character-appearance-service.js";

describe("character appearance service", () => {
  it("updates only whitelisted appearance keys and populates legacy avatar", async () => {
    const update = vi.fn().mockResolvedValue({ id: "char-1", appearanceKey: "male-01", avatar: "/characters/default/male-01.webp" });
    const db = { character: { update } } as never;
    await expect(setCharacterAppearance(db, "char-1", "male-01")).resolves.toMatchObject({ appearanceKey: "male-01" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "char-1" },
      data: { appearanceKey: "male-01", avatar: "/characters/default/male-01.webp" },
      select: { id: true, appearanceKey: true, avatar: true }
    });
  });

  it("rejects urls and path traversal keys before database update", async () => {
    const update = vi.fn();
    const db = { character: { update } } as never;
    await expect(setCharacterAppearance(db, "char-1", "https://example.com/a.png")).rejects.toBeInstanceOf(CharacterAppearanceError);
    await expect(setCharacterAppearance(db, "char-1", "../../npc/a")).rejects.toBeInstanceOf(CharacterAppearanceError);
    expect(update).not.toHaveBeenCalled();
  });
});
